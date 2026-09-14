// POST /api/recommend
// body: { targetSchool, targetMajor, entriesSummary }
// returns: { items: [{ title, category, reason, materials: [], steps: [] }, ...] }
//
// Calls the Google Gemini API server-side using GEMINI_API_KEY,
// so the key is never exposed to the browser.

const GEMINI_MODEL = "gemini-3.6-flash";

const RECOMMENDATION_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string", enum: ["autonomy", "club", "career", "subject", "behavior"] },
      reason: { type: "string" },
      materials: { type: "array", items: { type: "string" } },
      steps: { type: "array", items: { type: "string" } }
    },
    required: ["title", "category", "reason", "materials", "steps"]
  }
};

function extractJsonArray(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }

  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ code: "invalid_request", message: "POST 요청만 허용돼요." });
    return;
  }

  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    res.status(500).json({
      code: "server_not_configured",
      message: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았어요."
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const targetSchool = String(body.targetSchool || "").slice(0, 100);
  const targetMajor = String(body.targetMajor || "").slice(0, 100);
  const entriesSummary = String(body.entriesSummary || "").slice(0, 3000) || "(아직 작성한 활동 기록이 없음)";

  if (!targetSchool || !targetMajor) {
    res.status(400).json({ code: "invalid_request", message: "목표 대학교와 학과를 확인해주세요." });
    return;
  }

  const prompt = [
    "당신은 대한민국 고등학교 학생의 학교생활기록부(생기부)를 위한 입시 컨설턴트입니다.",
    `학생의 목표: "${targetSchool} ${targetMajor}"`,
    "",
    "학생이 지금까지 기록한 활동 목록(요약):",
    entriesSummary,
    "",
    "위 목표와 지금까지의 활동을 참고하여, 아직 하지 않았지만 추가로 하면 목표 학과 지원에 도움이 될 새로운 활동을 4개 추천하세요.",
    "지금까지 한 활동과 겹치지 않아야 하고, 학생이 실제로 학교나 집에서 실행 가능한 수준이어야 합니다.",
    "각 활동마다 필요한 재료·준비물과 구체적인 진행 방법(3~5단계)을 함께 제시하세요.",
    'category는 autonomy(자율활동), club(동아리), career(진로활동), subject(교과세특), behavior(행동특성) 중 하나로 지정하세요.'
  ].join("\n");

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2500,
            temperature: 0.8,
            responseMimeType: "application/json",
            responseSchema: RECOMMENDATION_SCHEMA,
            thinkingConfig: { thinkingLevel: "low" }
          }
        })
      }
    );

    if (upstream.status === 429) {
      res.status(429).json({ code: "rate_limited", message: "요청이 많아요. 잠시 후 다시 시도해주세요." });
      return;
    }
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("Gemini upstream error", upstream.status, errText.slice(0, 500));
      res.status(502).json({ code: "upstream_error", message: "AI 호출에 실패했어요.", detail: errText.slice(0, 300) });
      return;
    }

    const data = await upstream.json();

    if (data.promptFeedback && data.promptFeedback.blockReason) {
      res.status(502).json({ code: "invalid_json", message: "추천 결과를 정리하지 못했어요." });
      return;
    }

    const candidate = (data.candidates || [])[0];
    const text = ((candidate && candidate.content && candidate.content.parts) || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    const items = extractJsonArray(text);
    if (!items || !items.length) {
      console.error("Gemini recommend parse fail, finishReason:", candidate && candidate.finishReason, "text:", text.slice(0, 300));
      res.status(502).json({ code: "invalid_json", message: "추천 결과를 정리하지 못했어요." });
      return;
    }

    res.status(200).json({ items });
  } catch (err) {
    console.error("Gemini call threw", err && err.message);
    res.status(500).json({ code: "upstream_error", message: "서버 오류가 발생했어요." });
  }
};
