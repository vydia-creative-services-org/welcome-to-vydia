// cs-monitor health contract v1.1 — DO NOT EDIT IN PROJECTS. Source: cs-monitor-kit/project/lib/health.ts
import { timingSafeEqual } from "node:crypto";

export type Check = (signal: AbortSignal) => Promise<unknown>;
export type Checks = Record<string, Check | undefined>;
type Result = "ok" | "fail";

const TIMEOUT_MS = 2000;
const NO_STORE = { "Cache-Control": "no-store" };

function authorized(req: Request): boolean {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret || secret.length < 32) return false; // fail closed
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function run(name: string, check: Check): Promise<Result> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ctrl.abort(); reject(new Error("timeout")); }, TIMEOUT_MS);
  });
  try {
    await Promise.race([check(ctrl.signal), timeout]);
    return "ok";
  } catch (err) {
    console.error(`[health] ${name} failed`, err); // logs only, never the body
    return "fail";
  } finally {
    clearTimeout(timer);
  }
}

async function runAll(checks: Checks): Promise<Record<string, Result>> {
  const names = Object.keys(checks).filter((n) => checks[n]);
  const results = await Promise.all(names.map((n) => run(n, checks[n]!)));
  return Object.fromEntries(names.map((n, i) => [n, results[i]]));
}

/** critical decides 200/503. noncritical runs only with ?tier=all and never changes the status. */
export async function healthResponse(req: Request, critical: Checks, noncritical: Checks = {}): Promise<Response> {
  if (!authorized(req)) return new Response(null, { status: 404, headers: NO_STORE });
  const full = new URL(req.url).searchParams.get("tier") === "all" && Object.values(noncritical).some(Boolean);
  const [checks, extra] = await Promise.all([runAll(critical), full ? runAll(noncritical) : null]);
  const ok = Object.values(checks).every((r) => r === "ok");
  return Response.json(
    {
      status: ok ? "ok" : "fail",
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      checks,
      ...(extra ? { noncritical: extra } : {}),
    },
    { status: ok ? 200 : 503, headers: NO_STORE },
  );
}

/** Any route method other than GET: same 404 as an unauthorized request. */
export function notFound(): Response {
  return new Response(null, { status: 404, headers: NO_STORE });
}

/** fetch that throws on non-2xx. */
export async function fetchOk(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Passes on any HTTP answer < 500, redirects included. "Is the host up" checks. */
export async function reachable(url: string, init: RequestInit = {}): Promise<void> {
  const res = await fetch(url, { method: "HEAD", redirect: "manual", cache: "no-store", ...init });
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
}

export function requireEnv(...names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")}`);
}

/** Include a check only when its env vars are set (self-disabling adapters). */
export function whenConfigured(envs: string[], check: Check): Check | undefined {
  return envs.every((e) => process.env[e]) ? check : undefined;
}
