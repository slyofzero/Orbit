import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { languageName } from "@/lib/codeLanguages";
import { judge, status } from "@/lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route runs programs on your computer, so it only answers pages opened on this computer (localhost) by Orbit itself.
function allowed(req: NextRequest): string | null {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) return "Running code only works when Orbit is opened as localhost (http://localhost:3000), not through a network address.";
  if (req.headers.get("x-orbit-run") !== "1") return "Missing Orbit header.";
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return "Cross-site request refused.";
  if (req.headers.get("sec-fetch-site") === "cross-site") return "Cross-site request refused.";
  return null;
}

let busy = 0;

export async function GET(req: NextRequest) {
  const no = allowed(req);
  if (no) return NextResponse.json({ error: no }, { status: 403 });
  return NextResponse.json({ languages: status() });
}

export async function POST(req: NextRequest) {
  const no = allowed(req);
  if (no) return NextResponse.json({ error: no }, { status: 403 });
  let body: { language?: string; code?: string; inputs?: unknown; timeLimitMs?: number; cwd?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const lang = typeof body.language === "string" ? languageName(body.language) : null;
  if (!lang) return NextResponse.json({ error: "Unknown language." }, { status: 400 });
  if (typeof body.code !== "string" || body.code.length > 100_000) return NextResponse.json({ error: "The code is empty or too long (100,000 characters at most)." }, { status: 400 });
  if (!Array.isArray(body.inputs) || body.inputs.length === 0 || body.inputs.length > 40 || body.inputs.some((i) => typeof i !== "string" || i.length > 1_000_000)) return NextResponse.json({ error: "Bad inputs." }, { status: 400 });
  let cwd: string | undefined;
  if (typeof body.cwd === "string" && body.cwd.trim()) {
    cwd = body.cwd.trim();
    if (cwd.length > 500 || cwd.includes("\0") || !isAbsolute(cwd)) return NextResponse.json({ error: "The practice folder must be a full path, like C:\\Users\\you\\orbit-practice\\sql-1." }, { status: 400 });
    const st = await stat(cwd).catch(() => null);
    if (!st?.isDirectory()) return NextResponse.json({ error: `The practice folder "${cwd}" does not exist. Run the setup script first, or fix the path.` }, { status: 400 });
  }
  if (busy >= 2) return NextResponse.json({ error: "Two programs are already running. Wait a moment and try again." }, { status: 429 });
  const limit = typeof body.timeLimitMs === "number" ? Math.min(15000, Math.max(200, body.timeLimitMs)) : 3000;
  busy++;
  try { return NextResponse.json(await judge(lang, body.code, body.inputs as string[], limit, cwd)); }
  finally { busy--; }
}
