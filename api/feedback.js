// POST /api/feedback
// body: { targetSchool, targetMajor, categoryLabel, subject, content }
// returns: { text }
//
// Calls the Google Gemini API server-side using GEMINI_API_KEY,
// so the key is never exposed to the browser.

const GEMINI_MODEL = "gemini-3.6-flash";

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
  const categoryLabel = String(body.categoryLabel || "").slice(0, 60);
  const subject = String(body.subject || "").slice(0, 60);
  const content = String(body.content || "").slice(0, 3000);

  if (!targetSchool || !targetMajor || !content) {
    res.status(400).json({ code: "invalid_request", message: "목표 학과와 활동 내용을 확인해주세요." });
    return;
  }

  const prompt = [
    "당신은 대한민국 고등학교 학생의 학교생활기록부(생기부) 초고 작성을 돕는 입시 컨설턴트입니다.",
    `이 학생의 목표는 "${targetSchool} ${targetMajor}" 입니다.`,
    "",
    "학생이 작성한 생기부 초고입니다.",
    `- 항목: ${categoryLabel}${subject ? ` (과목: ${subject})` : ""}`,
    "- 내용:",
    '"""',
    content,
    '"""',
    "",
    "다음 5개 기준으로 한국어 피드백을 작성하세요. 각 기준은 소제목(예: '1. 구체성:')을 붙이고 반드시 2문장 이내로 짧게 쓰세요.",
    "1. 구체성: 활동의 과정과 결과가 구체적인 사례로 드러나는지",
    `2. 전공 적합성: ${targetMajor} 전공과의 연계성이 잘 드러나는지, 부족하면 보완 방향 제안`,
    "3. 탐구역량: 스스로 질문하고 확장해 탐구한 과정이 드러나는지",
    "4. 표현 다듬기: 더 명확하고 생기부다운 문장으로 다듬을 구체적 제안 1가지",
    "5. 개인정보 주의: 실명, 특정 인물, 사진, 자격증·어학시험 점수 등 기재 불가 정보가 보이면 짧게 지적하고, 없으면 '특별히 우려되는 부분은 없습니다'라고 쓰세요.",
    "",
    "전체 400자를 절대 넘기지 마세요. 학생을 격려하는 따뜻한 어투로, 마지막 5번 기준까지 반드시 다 쓰고 끝내세요.",
    "마크다운 문법(별표 **, 샵 #, 하이픈 - 등)은 절대 쓰지 말고, 일반 텍스트로만 작성하세요."
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
            maxOutputTokens: 2200,
            temperature: 0.6,
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
      res.status(502).json({ code: "empty_completion", message: "AI가 응답을 생성하지 못했어요." });
      return;
    }

    const candidate = (data.candidates || [])[0];
    const text = ((candidate && candidate.content && candidate.content.parts) || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      console.error("Gemini empty text, finishReason:", candidate && candidate.finishReason);
      res.status(502).json({ code: "empty_completion", message: "AI가 응답을 생성하지 못했어요." });
      return;
    }

    if (candidate && candidate.finishReason === "MAX_TOKENS") {
      console.error("Gemini response truncated (MAX_TOKENS)");
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error("Gemini call threw", err && err.message);
    res.status(500).json({ code: "upstream_error", message: "서버 오류가 발생했어요." });
  }
};
