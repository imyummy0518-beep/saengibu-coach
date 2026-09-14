# 생기부 코치 — 배포 가이드 (Google Gemini API, 무료 버전)

로그인 없이 누구나 링크로 들어와서 쓸 수 있고, 실시간 AI 첨삭·추천까지 되는 버전이에요.
회원가입/활동 기록은 각자의 브라우저에 저장되고, AI 호출만 이 프로젝트의 작은 서버(API)를 거쳐요 — 그래서 Claude 계정이나 구글 로그인 없이도 방문자는 AI 기능을 바로 쓸 수 있습니다.

**Anthropic API 대신 Google Gemini API를 사용해요.** Gemini API는 카드 등록 없이 무료로 키를 받아 쓸 수 있는 "Free tier"가 있어서, 대회 제출처럼 비용을 아예 들이고 싶지 않을 때 적합해요. 다만 무료라는 이유로 생기는 제약도 있으니 아래 "무료 사용량 한도"와 "알아둘 점"을 꼭 읽어주세요.

이미 GitHub 계정이 있다고 하셨으니, 그 기준으로 안내할게요. 전체 과정은 15~20분 정도 걸려요.

## 1. Gemini API 키 발급받기 (무료, 카드 등록 불필요)

1. https://aistudio.google.com/apikey 접속 후 구글 계정으로 로그인.
2. **Create API key** 클릭 → 새 프로젝트를 만들거나 기존 프로젝트 선택 → 키 생성.
3. 생성된 키를 복사해서 안전한 곳에 잠깐 메모해두세요.
4. 카드 등록이나 결제 정보 입력 없이 바로 무료로 사용할 수 있어요 ("Free tier"는 결제 계정을 연결하지 않은 상태를 말해요).

## 2. 이 프로젝트를 GitHub에 올리기

터미널에서 이 폴더로 이동한 뒤:

```bash
git init
git add .
git commit -m "생기부 코치 초기 버전"
```

GitHub에서 새 저장소(Repository)를 만든 뒤 (Public/Private 상관없어요), 안내되는 명령어로 푸시하세요. 보통 이런 모양이에요:

```bash
git remote add origin https://github.com/내아이디/saengibu-coach.git
git branch -M main
git push -u origin main
```

## 3. Vercel에 배포하기

1. https://vercel.com 접속 → **Continue with GitHub** 로 가입/로그인 (GitHub 계정 그대로 쓰면 돼요, 무료).
2. **Add New → Project** 클릭 → 방금 올린 `saengibu-coach` 저장소 선택 → **Import**.
3. Framework Preset은 **Other**(또는 자동 감지된 값 그대로) 두고, 별다른 설정 변경 없이 **Deploy** 클릭.
   - 이 배포는 아직 API 키가 없어서 AI 기능은 에러가 날 거예요. 정상이니 다음 단계로 진행하세요.
4. 배포가 끝나면 프로젝트 화면에서 **Settings → Environment Variables** 로 이동.
5. Key에 `GEMINI_API_KEY`, Value에 1단계에서 복사해둔 키를 붙여넣고, Production/Preview/Development 모두 체크한 뒤 **Save**.
6. **Deployments** 탭에서 최신 배포 옆 **⋯ → Redeploy** 를 눌러 환경변수를 반영해서 다시 배포하세요.

배포가 끝나면 `https://saengibu-coach-아무개.vercel.app` 같은 주소가 생겨요. **이 링크가 진짜 공개 링크예요** — 로그인 없이 아무나 들어와서 회원가입하고, AI 첨삭·추천을 받을 수 있어요.

## 4. 확인해보기

- 배포된 링크를 시크릿 창(또는 다른 기기)으로 열어서 회원가입 → 활동 기록 작성 → "AI 피드백 받기" 까지 눌러서 실제로 응답이 오는지 확인하세요.
- 안 되면 Vercel 프로젝트의 **Deployments → 해당 배포 → Functions** 탭에서 `/api/feedback`, `/api/recommend` 로그를 확인하면 원인(예: 키 오타)을 알 수 있어요.

## 무료 사용량 한도 (중요)

Gemini API 무료 tier는 **키(프로젝트) 하나 기준으로** 아래와 같은 한도가 있어요 (2026년 9월 기준, `gemini-2.5-flash` 모델). 방문자 한 명당 한도가 아니라 **링크에 들어온 모든 사람이 이 한도를 함께 나눠 써요.**

- 분당 요청 수(RPM): 약 10회
- 하루 요청 수(RPD): 약 1,500회
- 분당 토큰 수(TPM): 약 250,000

즉 대회 심사 시간대에 한꺼번에 여러 명이 몰리면 "요청이 많아요" 오류(`rate_limited`)가 뜰 수 있어요. 이 앱은 그 상황을 감지해서 사용자에게 "잠시 후 다시 시도해주세요"라고 안내하도록 이미 만들어져 있어요. 발표·심사 당일처럼 접속이 몰릴 시간이 예상되면, 미리 https://aistudio.google.com/apikey 에서 결제 계정을 연결해두면(소액 과금 방식으로 전환) 한도가 크게 올라가지만, 완전 무료를 유지하려면 위 한도 안에서 쓰는 걸 권장해요.

## 알아둘 점 (무료 tier 특성)

- **무료 tier는 카드 등록이 필요 없고 비용이 청구되지 않아요.** 한도를 넘으면 과금되는 게 아니라 그 요청이 그냥 실패해요(429 오류) — 그래서 "예상 밖의 비용" 걱정 없이 안전하게 쓸 수 있어요.
- **구글이 무료 tier로 오간 입력·출력 내용을 자사 서비스 개선에 활용할 수 있다고 밝히고 있어요.** 이 앱은 애초에 실명·사진 등 개인정보를 적지 않도록 설계되어 있으니 큰 문제는 아니지만, 참고해두세요. (결제 계정을 연결한 유료 사용은 이 정책이 다르게 적용돼요.)
- 한도나 모델 종류는 구글이 언제든 바꿀 수 있어요. 최신 정보는 https://ai.google.dev/gemini-api/docs/pricing 와 https://aistudio.google.com/rate-limit 에서 확인할 수 있어요.

## 참고

- `api/feedback.js`, `api/recommend.js` 가 AI를 호출하는 서버 코드예요. API 키는 Vercel 환경변수에만 있고, 브라우저(사용자 화면)에는 절대 노출되지 않아요.
- `public/index.html` 이 화면 전체(회원가입/로그인/작성/추천)예요. 계정과 활동 기록은 서버가 아니라 **각 방문자의 브라우저(localStorage)** 에 저장돼요 — 즉 여러 명이 같은 계정 목록을 공유하는 게 아니라, 각자 자기 브라우저 안에서 독립적으로 사용하는 구조예요.
- 나중에 문구나 프롬프트를 수정하고 싶으면 해당 파일을 고친 뒤 GitHub에 다시 `git push` 하면 Vercel이 자동으로 재배포해요.
- 더 높은 요청 한도가 필요하면 `api/feedback.js`, `api/recommend.js`의 `GEMINI_MODEL` 값을 `gemini-2.5-flash-lite`로 바꿔보세요. 응답 품질은 약간 낮아지지만 분당 요청 한도가 더 높아요.
