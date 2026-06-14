// /api/claude  —  Vercel Serverless Function (Node.js)
// 프런트엔드의 callClaude()가 이 엔드포인트로 요청을 보냅니다.
// API 키는 절대 코드/깃허브에 넣지 말고, Vercel 환경변수(ANTHROPIC_API_KEY)에만 저장하세요.
//
// 다른 LLM을 쓰고 싶다면 아래 fetch 부분을 OpenAI / Gemini 호출로 바꾸고,
// 응답을 { content: [{ type:"text", text:"..." }] } 형태로 맞춰서 돌려주면
// 프런트엔드를 수정하지 않아도 그대로 동작합니다.

export default async function handler(req, res) {
  // --- 간단한 CORS / 메서드 가드 ---
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // 클라이언트가 보낸 model/system/messages/max_tokens 를 그대로 전달 (안전 기본값 포함)
    const payload = {
      model: body.model || "claude-sonnet-4-6",
      max_tokens: Math.min(body.max_tokens || 1000, 1500),
      system: body.system,
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
