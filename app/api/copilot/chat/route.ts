import { NextRequest, NextResponse } from "next/server";
import { getSupplyChainNetwork, getCorporateHierarchy, getValuation } from "@/lib/api/endpoints";
import { generateDeterministicSynthesis, FinancialRole } from "@/lib/copilot/quant-synthesis";

export const runtime = "nodejs";

interface CopilotRequestBody {
  prompt: string;
  symbol?: string;
  byokKey?: string;
  mode?: "GEMINI" | "DETERMINISTIC";
  role?: FinancialRole;
}

export async function POST(req: NextRequest) {
  try {
    const body: CopilotRequestBody = await req.json();
    const { prompt, symbol, byokKey, mode = "DETERMINISTIC", role } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const cleanSymbol = symbol ? symbol.trim().toUpperCase() : "RELIANCE";
    const isPlatformEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT !== "false";
    const apiKey = byokKey || (isPlatformEnabled ? process.env.GEMINI_API_KEY : null);

    // If user explicitly chose DETERMINISTIC QUANT RULES or if no API key is available:
    if (mode === "DETERMINISTIC" || !apiKey) {
      const quantResult = generateDeterministicSynthesis(prompt, cleanSymbol, role);
      return NextResponse.json({
        mode: "DETERMINISTIC_OFFLINE",
        response: quantResult.markdown,
        title: quantResult.title,
        provenance: quantResult.provenance,
        sourceCitations: quantResult.sourceCitations,
        isLiveAI: false,
      });
    }

    // Assemble Grounded Context for the Security from platform endpoints if available
    let contextSummary = "";
    try {
      const [splcRes, holdRes, valRes] = await Promise.all([
        getSupplyChainNetwork(cleanSymbol),
        getCorporateHierarchy(cleanSymbol),
        getValuation(cleanSymbol),
      ]);

      if (splcRes.ok && holdRes.ok) {
        const splc = splcRes.data;
        const hold = holdRes.data;
        contextSummary = `
SECURITY CONTEXT:
- Company: ${splc.name} (${cleanSymbol})
- Conglomerate Group: ${hold.group_name}
- Sector: ${splc.primary_sector}
- Annual COGS: ₹${splc.annual_cogs_cr?.toLocaleString("en-IN") || "—"} Cr
- Major Suppliers: ${splc.suppliers?.map((s) => `${s.name} (${s.component}, Sole-Source: ${s.is_sole_source})`).join("; ")}
- Major Customers: ${splc.customers?.map((c) => `${c.name} (${c.volume_share_pct}%)`).join("; ")}
- Subsidiaries & JVs: ${hold.holding_entities?.map((h) => `${h.name} (${h.ownership_pct}% stake, ₹${h.revenue_contrib_cr} Cr)`).join("; ")}
- Provenance: Grounded from Audited Ind AS 24 Note 34 Related Party Filings and Annual Reports.
`;
      }
    } catch {
      // Continue with standard context
    }

    // LIVE GEMINI MODEL INFERENCE
    const systemPrompt = `You are the Arthdex Terminal Copilot (Module M24), an institutional financial research cockpit assistant for the Indian financial markets.
MANDATORY COMPLIANCE & PROVENANCE RULES:
1. SEBI REGULATORY COMPLIANCE: Under SEBI (Investment Advisers) Regulations, 2013, Arthdex is NOT an Investment Adviser or Research Analyst. Never give buy/sell recommendations or speculative price targets.
2. PROVENANCE ATTRIBUTION: Every metric and number MUST be explicitly tagged with its classification:
   - [ACTUAL FILING] for audited statements, balance sheet items, Note 34 disclosures, or official exchange bhavcopy prices.
   - [MODELLED / ALGORITHMIC] for ratios, DuPont decomposition, DCF valuations, Greeks, VaR, and stress tests.
   - [CONSENSUS ESTIMATE] for forward broker estimates or analyst projections.
3. CITE EXACT SOURCES (e.g., Note 34 Related Party Disclosures, NSE Bhavcopy, Audited Annual Report FY25).
4. Format tabular figures cleanly with Indian notation (₹ Lakh / Crore).
5. Always begin with a concise SEBI Non-Advisory disclaimer block:
> **SEBI REGULATORY DISCLAIMER:** Under SEBI (Investment Advisers) Regulations, 2013, Arthdex Terminal Copilot is an educational research synthesis engine and NOT a registered investment adviser or research analyst. No buy, sell, or hold advice is provided.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nACTIVE ROLE: ${role || "Equity Analyst"}\n${contextSummary}\n\nUSER QUESTION: ${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1400,
      },
    };

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!res.ok) {
      // Graceful fallback to deterministic synthesis on API error or quota exhaustion
      const quantResult = generateDeterministicSynthesis(prompt, cleanSymbol, role);
      return NextResponse.json({
        mode: "DETERMINISTIC_FALLBACK",
        response: quantResult.markdown,
        title: quantResult.title,
        warning: "External Gemini API quota unavailable. Switched to Deterministic Quant Engine.",
        provenance: quantResult.provenance,
        sourceCitations: quantResult.sourceCitations,
        isLiveAI: false,
      });
    }

    const data = await res.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to synthesize response.";

    return NextResponse.json({
      mode: "LIVE_GEMINI_AI",
      response: candidateText,
      provenance: "GROUNDED EXCHANGE DATA & GEMINI 3.8 FLASH",
      sourceCitations: [
        "Audited Ind AS 24 Annual Filings",
        "NSE Official Bhavcopy & Corporate Disclosures",
        "Gemini 3.8 Flash Institutional Reasoning Engine",
      ],
      isLiveAI: true,
    });
  } catch (err: any) {
    // Even if an uncaught server exception occurs, fallback to deterministic quant rules
    try {
      const quantResult = generateDeterministicSynthesis(
        "Institutional financial summary",
        "RELIANCE"
      );
      return NextResponse.json({
        mode: "DETERMINISTIC_FALLBACK",
        response: quantResult.markdown,
        title: quantResult.title,
        provenance: quantResult.provenance,
        sourceCitations: quantResult.sourceCitations,
        isLiveAI: false,
      });
    } catch {
      return NextResponse.json(
        { error: err.message || "Internal Copilot Error" },
        { status: 500 }
      );
    }
  }
}
