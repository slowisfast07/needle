# Needle (가제) — MVP

가설: "종목+장기 근거를 한 번 입력하면, AI가 내 원칙을 읽고 매도 시그널·관찰 포인트를 추천하고
핵심 뉴스를 장기 관점으로 색 분류해주는 도구에 장기투자자는 가치를 느끼고 다시 찾아온다."
ChatGPT에 매번 뉴스를 붙여넣는 것과의 차별점 = 한 번 저장 → 지속 코칭 + 큐레이션 + 장기 관점 + 매도/관찰 가이드 추천.

## 담긴 기능 (브리핑 생성 시)
1. 🎯 오늘의 핵심 뉴스 3 — 4색 분류
   회색=단기 노이즈 / 초록=단기 악재·장기 호재 / 노랑=혼조·애매 / 빨강=장기 악재
2. 🚨 추천 매도 시그널 — 내가 쓴 근거를 AI가 읽고 "이런 뉴스 나오면 매도 고려" 제안
3. 👀 지켜봐야 할 포인트 — 근거 기반 관찰 항목 추천 (예: IREN의 Horizon 1-4 Q3'26 인도 여부)
4. 💡 이 종목 투자자들의 공통 투자근거 + 👤 고수별 근거 vs 내 근거(일치/부분/다름)
+ 뉴스 직접 점검(유지) · 대기자 등록(가짜 문) · 👍/👎 · 행동추적 · KO/EN · 다크모드

## 🧪 데모 모드 (배포·API 없이도 항상 작동)
- NVDA(엔비디아) 또는 IREN 입력 → 미리 만든 예시 브리핑이 즉시 표시(예시 배지 표시)
- 사용자 테스트·시연용. 다른 종목은 배포(아래)에서 AI가 실시간 분석.
- 이 방식이 린 스타트업의 'Wizard of Oz' MVP: 백엔드 없이 가치부터 검증.

## 솔직한 한계 / 로드맵
- "매일 아침 손 안 대도 자동 메일"은 스케줄러(Vercel Cron)+사용자 DB+메일발송이 필요(백엔드).
  지금은 경험만 보여주고, 자동 발송 수요는 '대기자 등록'으로 검증 → 검증되면 백엔드 추가.

------------------------------------------------------------
## 배포 (Vercel 권장)
1. GitHub 업로드(키 제외) → vercel.com Import → Deploy
2. AI(실시간 분석) 켜기: Settings → Environment Variables → ANTHROPIC_API_KEY → Redeploy
   (https://console.anthropic.com 발급) — 데모(NVDA/IREN)는 키 없이도 동작

## 분석 — Vercel Analytics (무료·쿠키리스·동의배너 불필요)
- 프로젝트 → Analytics → Enable (스크립트는 index.html에 포함)
- Plausible 교체 시 그 <script>만 바꾸면 track()이 자동 인식
이벤트: page_view, cta_click, holding_add, demo_view, briefing_run, briefing_success,
headline_click, manual_check_run, feedback(vote), waitlist_signup, name_vote(choice), character_run(creature·market), character_share, character_cta, example_fill, manual_demo_view, lang_toggle

## 대기자 이메일 — Formspree (백엔드 없이)
1. https://formspree.io 폼 생성 → 엔드포인트 복사 → index.html 상단 FORM_ENDPOINT 에 붙여넣기
   (비우면 데모) ※ 이메일은 개인정보 → 동의 체크박스 유지(PIPA)

------------------------------------------------------------
## 성공 기준(미리 정하기) 예시
- 활성화: 방문자 30%+ 가 brief 1회 이상 생성
- 가치 체감: brief 후 👍 60%+
- 리텐션(가장 중요): 7일 내 재방문 + 재생성 20%+
- 수요: 방문자 8~15% 가 waitlist_signup
페이지뷰는 허영 지표. 위 4개가 진짜 신호.

## 첫 유입
디스콰이엇(disquiet.io), 긱뉴스(news.hada.io), 주식 카페/갤러리, Threads/X + 초기 사용자 5~10명 인터뷰.
