/**
 * `npm run dev`: start the FastAPI data service and the Next.js site together.
 *
 * The site has no data of its own. Run on its own, every market, company, IPO and
 * screener page renders empty, which is the failure this script exists to prevent.
 * If a data service is already answering on the port it is reused, not duplicated.
 * `npm run dev:web` still starts the site alone.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const API = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";
const port = new URL(API).port || "8000";
const children = [];

const python = [
  join(backend, ".venv", "Scripts", "python.exe"),
  join(backend, ".venv", "bin", "python"),
].find(existsSync);

async function healthy() {
  try {
    const res = await fetch(`${API}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function run(label, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const tag = `[${label}] `;
  const pipe = (stream, out) =>
    stream.on("data", (chunk) => out.write(chunk.toString().replace(/^(?=.)/gm, tag)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${tag}exited (${code ?? "signal"})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (await healthy()) {
  console.log(`[api] data service already running at ${API}, reusing it`);
} else if (!python) {
  console.error(
    "[api] backend/.venv not found, so the data service cannot start and every data page will be empty.\n" +
      "      Set it up once: cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt",
  );
} else {
  run("api", python, ["-m", "uvicorn", "app.main:app", "--port", port], backend);
  const deadline = Date.now() + 90_000;
  while (!(await healthy()) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1000));
  console.log((await healthy()) ? `[api] ready at ${API}` : "[api] not answering yet; the site will show it as offline until it is");
}

// Next's own CLI under this Node binary: no shell, so arguments are passed through unmodified
run("web", process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "dev", ...process.argv.slice(2)], root);
