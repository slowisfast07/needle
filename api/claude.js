// /api/claude  —  Vercel Serverless Function (Node.js)
// 프런트엔드의 callClaude()가 이 엔드포인트로 요청을 보냅니다.
// API 키는 절대 코드/깃허브에 넣지 말고, Vercel 환경변수(ANTHROPIC_API_KEY)에만 저장하세요.
//
// ── 비용 방어(2026-06 추가) ───────────────────────────────────────────────
// 이 엔드포인트는 "내 Anthropic 키로 Claude를 호출"하므로, 보호가 없으면 누구나
// curl 로 때려서 내 크레딧을 태울 수 있습니다. 아래 3중 방어를 둡니다.
//   1) 출처(Origin/Referer) 검사 — 내 사이트의 브라우저에서 온 요청만 허용
//   2) 입력 가드 — 허용 모델만, 본문 크기/길이 상한
//   3) (선택) Upstash Redis 레이트리밋 — IP당/전체 일일 한도 = 폭탄 방지 차단기
//
// 환경변수
//   ANTHROPIC_API_KEY         (필수) — Anthropic 콘솔에서 발급
//   ALLOWED_ORIGINS           (선택) — 커스텀 도메인 쓸 때 콤마로. 예: https://needle.app,https://www.needle.app
//                                      (이 배포본과 "같은 호스트"는 기본으로 자동 허용)
//   UPSTASH_REDIS_REST_URL    (선택) — 있으면 레이트리밋 켜짐
//   UPSTASH_REDIS_REST_TOKEN  (선택)
//   RL_PER_IP_PER_DAY         (선택, 기본 30)   — IP 하나가 하루에 쓸 수 있는 호출 수
//   RL_GLOBAL_PER_DAY         (선택, 기본 1500) — 사이트 전체 하루 상한(= 청구서 차단기)
// ─────────────────────────────────────────────────────────────────────────
//
// 다른 LLM을 쓰고 싶다면 아래 fetch 부분을 OpenAI / Gemini 호출로 바꾸고,
// 응답을 { content: [{ type:"text", text:"..." }] } 형태로 맞춰서 돌려주면
// 프런트엔드를 수정하지 않아도 그대로 동작합니다.

// 실제로 쓰는 모델만 허용 — 비싼 모델을 임의로 요청해 비용 태우는 걸 막음.
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_BODY_BYTES = 60 * 1024; // 60KB — 정상 브리핑 요청은 이보다 훨씬 작음

/* ── 1) 출처 검사 ─────────────────────────────────────────────────────────
 * 내 사이트(같은 호스트) 또는 ALLOWED_ORIGINS 의 브라우저에서 온 요청만 통과.
 * 브라우저는 POST 에 Origin 헤더를 항상 붙이므로, Origin/Referer 가 아예 없으면
 * (= 순수 curl/스크립트) 거부한다.  ⚠️ 헤더는 위조 가능하므로 이건 "1차 방어"이고,
 * 진짜 폭탄 방지는 3) 레이트리밋(전체 일일 한도)이 담당한다. */
function allowedHostSet() {
  const out = new Set();
  for (const raw of (process.env.ALLOWED_ORIGINS || "").split(",")) {
    const v = raw.trim();
    if (!v) continue;
    try { out.add(new URL(v.includes("://") ? v : `https://${v}`).host.toLowerCase()); } catch { /* skip */ }
  }
  for (const v of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    if (v) out.add(v.toLowerCase());
  }
  out.add("localhost:5173");
  out.add("localhost:3000");
  return out;
}
function originOk(req) {
  const host = (req.headers.host || "").toLowerCase();          // 이 배포본 자신의 호스트
  const extra = allowedHostSet();
  const hostOf = (val) => { try { return new URL(val).host.toLowerCase(); } catch { return ""; } };
  const ok = (h) => !!h && (h === host || extra.has(h));
  const origin = req.headers.origin;
  if (origin) return ok(hostOf(origin));
  const referer = req.headers.referer;
  if (referer) return ok(hostOf(referer));
  return false; // POST 인데 Origin/Referer 둘 다 없음 → 정상 브라우저 아님
}

/* ── 3) (선택) Upstash Redis 레이트리밋 ───────────────────────────────────
 * 환경변수가 없으면 그냥 통과(데모/로컬에서도 동작하도록). 있으면 IP당·전체 일일 한도.
 * SDK 없이 REST 로만 호출하므로 추가 의존성 없음. */
async function rateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return { ok: true }; // 미설정 → 레이트리밋 비활성(출처 검사만으로 동작)

  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `rl:ip:${day}:${ip}`;
  const gKey = `rl:all:${day}`;
  const PER_IP = Number(process.env.RL_PER_IP_PER_DAY || 30);
  const GLOBAL = Number(process.env.RL_GLOBAL_PER_DAY || 1500);
  const cmds = [
    ["INCR", ipKey], ["EXPIRE", ipKey, 172800],
    ["INCR", gKey],  ["EXPIRE", gKey, 172800],
  ];
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: JSON.stringify(cmds),
    });
    const j = await r.json();
    const ipCount = Number(j?.[0]?.result || 0);
    const gCount = Number(j?.[2]?.result || 0);
    if (gCount > GLOBAL) return { ok: false, code: 503, msg: "오늘 무료 분석 한도에 도달했어요. 내일 다시 시도해 주세요." };
    if (ipCount > PER_IP) return { ok: false, code: 429, msg: "오늘 사용 한도를 초과했어요. 잠시 후 다시 시도해 주세요." };
    return { ok: true };
  } catch {
    return { ok: true }; // 레이트리밋 인프라 장애가 서비스를 막지 않도록 fail-open
  }
}

export default async function handler(req, res) {
  // --- 간단한 CORS / 메서드 가드 ---
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  // 1) 출처 검사
  if (!originOk(req)) { res.status(403).json({ error: "forbidden" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }); return; }

  // 3) 레이트리밋(설정돼 있을 때만)
  const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || "unknown";
  const rl = await rateLimit(ip);
  if (!rl.ok) { res.status(rl.code).json({ error: rl.msg }); return; }

  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    // 2) 입력 가드 — 본문 크기 상한
    if (rawBody.length > MAX_BODY_BYTES) { res.status(413).json({ error: "요청이 너무 큽니다." }); return; }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // 허용 모델만(아니면 기본값으로 강제) + max_tokens 상한
    const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
    const payload = {
      model,
      max_tokens: Math.min(Number(body.max_tokens) || 1000, 2000),
      system: typeof body.system === "string" ? body.system.slice(0, 20000) : body.system,
      messages: Array.isArray(body.messages) ? body.messages.slice(0, 20) : [],
    };
    // 뉴스 레이더 / AI 리서치의 웹 검색 도구를 그대로 전달
    if (Array.isArray(body.tools)) payload.tools = body.tools;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }

    // 프런트엔드가 기대하는 형태({content:[{type:'text',text}]})로 그대로 반환
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
