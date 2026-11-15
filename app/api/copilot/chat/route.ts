import { NextRequest, NextResponse } from "next/server";

import { getInstitutionalTearSheet } from "@/lib/api/endpoints";
import { isCrossSiteRequest, isValidSymbol, rateLimit } from "@/lib/api/request-guards";
import { buildBrief, groundingFor } from "@/lib/copilot/brief";
import type { FinancialRole } from "@/lib/copilot/quant-synthesis";

export const runtime = "nodejs";

interface CopilotRequestBody {
  prompt: string;
  symbol?: string;
  byokKey?: string;
  mode?: "GEMINI" | "DETERMINISTIC";
  role?: FinancialRole;
}

const MAX_PROMPT_CHARS = 4000;
const ROLE_LABELS: Record<FinancialRole, string> = {
  equity_analyst: "Equity Analyst",
  derivatives_trader: "Derivatives Trader",
  risk_officer: "Risk Officer",
  macro_splc: "Macro and Ownership Analyst",
};

const SYSTEM_PROMPT = `You are the Arthdex research assistant for Indian listed companies.
Rules:
1. Arthdex is not a SEBI-registered investment adviser or research analyst. Never give buy, sell or hold advice or your own price targets.
2. Use only the figures in COMPANY DATA below. Do not state any number that is not in it. If the question needs data that is not there, say that it is not available and name what would be needed.
3. Label each figure by kind: [EXCHANGE DATA] for prices and market cap, [ACTUAL FILING] for financial statements and shareholding, [CONSENSUS ESTIMATE] for analyst figures, [CALCULATED] for anything you derive, showing the arithmetic.
4. Use Indian notation (₹, lakh, crore). Prices are delayed.
5. Begin with one line: "Information only, not investment advice."`;

function unavailable(symbol: string, status: number) {
  const reason =
    status === 404
      ? `${symbol} is not covered by the data sources, so there are no figures to report.`
      : "The data service did not respond, so there are no figures to report. Try again shortly.";
  return NextResponse.json({
    mode: "UNAVAILABLE",
    title: `${symbol}: no data`,
    response: reason,
    provenance: "NO DATA",
    sourceCitations: [],
    isLiveAI: false,
  });
}

export async function POST(req: NextRequest) {
  // The route can spend the platform's model quota, so it answers this site only and at a bounded rate.
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request forbidden" }, { status: 403 });
  }
  const wait = rateLimit("copilot", req, 15, 60_000);
  if (wait) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  let body: CopilotRequestBody;
  try {
    body = ((await req.json()) ?? {}) as CopilotRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { prompt, byokKey, mode = "DETERMINISTIC" } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: `Prompt is limited to ${MAX_PROMPT_CHARS} characters` }, { status: 413 });
  }
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ error: "Enter a ticker symbol to ask about a company" }, { status: 400 });
  }
  if (byokKey !== undefined && byokKey !== null && byokKey !== "" && !(typeof byokKey === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(byokKey))) {
    return NextResponse.json({ error: "API key is not in a recognised format" }, { status: 400 });
  }
  const role = body.role && body.role in ROLE_LABELS ? body.role : undefined;

  // Every answer, offline or from the model, is built on the company's own figures
  const sheet = await getInstitutionalTearSheet(symbol);
  if (!sheet.ok) return unavailable(symbol, sheet.status);
  const brief = buildBrief(prompt, sheet.data);
  const offline = (modeLabel: string, warning?: string) =>
    NextResponse.json({ mode: modeLabel, response: brief.markdown, title: brief.title, provenance: brief.provenance, sourceCitations: brief.sourceCitations, warning, isLiveAI: false });

  const isPlatformEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT !== "false";
  const apiKey = byokKey || (isPlatformEnabled ? process.env.GEMINI_API_KEY : null);
  if (mode === "DETERMINISTIC" || !apiKey) return offline("DETERMINISTIC_OFFLINE");

  try {
    // The key travels in a header, never in the URL, so it cannot land in access or proxy logs.
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        // Instructions and data go in systemInstruction; the user's text stays in its own turn
        // so it cannot pose as an instruction.
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\nPERSPECTIVE: ${role ? ROLE_LABELS[role] : "Equity Analyst"}\n\nCOMPANY DATA (JSON):\n${groundingFor(sheet.data)}` }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return offline("DETERMINISTIC_FALLBACK", "The AI model is unavailable right now, so this is the offline summary of the figures on file.");

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      return offline("DETERMINISTIC_FALLBACK", "The AI model returned no answer, so this is the offline summary of the figures on file.");
    }
    return NextResponse.json({
      mode: "LIVE_GEMINI_AI",
      response: text,
      title: `${symbol}: AI analysis`,
      provenance: "AI-WRITTEN FROM ARTHDEX FIGURES; CHECK NUMBERS AGAINST THE COMPANY PAGE",
      sourceCitations: [...brief.sourceCitations, "Gemini (text generation only)"],
      isLiveAI: true,
    });
  } catch (err) {
    console.error("copilot:", err instanceof Error ? err.message : err);
    return offline("DETERMINISTIC_FALLBACK", "The AI model could not be reached, so this is the offline summary of the figures on file.");
  }
}
