# Issue #12 — 출간 모달 모바일 (세로 스크롤 + 배경 잠금)

> **For the next worker:** 이 폴더는 개인 블로그(ShyLog, Next.js 14 App Router + Tailwind) 관리자 영역 모바일 최적화 에픽(GitHub milestone #1 "관리자 모바일 최적화", 트래킹 이슈 #15, 설계: `.workflow/docs/epics/admin-mobile/design.md`)의 자식 이슈 **C = 출간 모달**의 전체 기록입니다. `/lead-issue 12` 워크플로우(PM=Claude, 구현/리뷰=독립 Codex 프로세스)로 진행됐습니다.

## 최종 상태: ✅ 완료 · 병합됨

- **PR:** [NJ97S/personal-blog#18](https://github.com/NJ97S/personal-blog/pull/18) — squash 병합 완료.
- **이슈:** #12 CLOSED (PR 본문 `Closes #12`로 자동 닫힘).
- **변경 파일:** `components/PublishModal.tsx` 단독 (구현 문서 제외).
- **프리뷰 검증:** Vercel 프리뷰 배포에서 실기기로 세로 스크롤·배경 잠금·터치 타깃 확인 완료.

## 무엇을 했나

관리자 출간 모달을 폰(~360–430px)에서 쓸 수 있게 반응형 보정했습니다. 데스크톱 표시는 그대로 유지합니다.

1. **뷰포트에 갇힌 스크롤 모달** — 다이얼로그를 `flex flex-col` + 높이 상한(모바일 `max-h-[calc(100dvh-1rem)]` / 데스크톱 `md:max-h-[calc(100vh-4rem)]`)으로 두고, 헤더·푸터는 `shrink-0` 고정, 가운데 본문 + `dangerZone`을 `min-h-0 flex-1 overflow-y-auto` 스크롤 영역에 배치. 내용이 길어도 하단 출간/취소 버튼·삭제 영역까지 도달 가능.
2. **배경 스크롤 잠금** — 모달 열림 중 `document.body` 스크롤을 잠그고 닫힘/언마운트 시 원복. 공개 측 `CategoryDrawer` 패턴을 재사용해 기존 Esc effect 수명주기에 통합.
3. **모바일 터치 타깃** — 닫기·취소·출간·업로드·제거·공개설정 토글을 폰에서 ~44px로 키우고 `md:`로 데스크톱 치수 복원.

## 핵심 설계 결정 (why)

- **포털 이동 안 함** — 출간 버튼이 `type="submit"`으로 호출부 `<form>` 컨텍스트에 의존. `createPortal`로 body에 옮기면 폼 제출이 깨진다(Scope Fence 위반). 그래서 인라인 유지 + `fixed`로 시각적 오버레이만.
- **prop 인터페이스·slot 내용 불변** — `dangerZone`/`categoryPicker`로 넘어오는 내용 마크업(삭제 버튼, 카테고리 `<select>`)은 형제 이슈 #11/부모 소유. C는 담는 그릇만 반응형으로.
- **반응형 프리픽스로 데스크톱 무영향** — 높이 상한·터치 타깃 모두 `md:`로 데스크톱 현행 복원. 내용이 상한보다 짧은 데스크톱에선 스크롤바 미출현 → 시각 동일.

## 문서

- [plan.md](plan.md) — PM 계획 (Goal / Scope Fence / Approach / Design decisions / Edge cases / Non-goals).
- [plan-review.md](plan-review.md) — fresh-eyes 계획 리뷰. **PASS** (0 blocking).
- [report.md](report.md) — Developer 구현 보고서 (변경·설계 결정·검증·에스컬레이션).
- [pr-review-r1.md](pr-review-r1.md) — fresh-eyes PR 코드 리뷰. **APPROVE** (0 findings).

## 히스토리 요약

| Phase | 결과 |
|---|---|
| P1 컨텍스트 + 스코프 펜스 | 사용자 승인 |
| P3 계획 작성 | plan.md |
| P5 계획 리뷰 (fresh eyes) | PASS, 비차단 제안 2건 반영, 사용자 승인 |
| P6 구현 (Developer, worktree) | 편차 없음, lint/build 통과. 에스컬레이션: 로컬 실브라우저 확인 불가(worktree Supabase env 부재 + /admin 인증) |
| P7 Push + PR #18 | 사용자 승인 후 push, Vercel 프리뷰 배포 성공 |
| P8 PR 코드 리뷰 (fresh eyes) | APPROVE (0 findings) |
| P9 병합 | 사용자 실기기 확인 후 squash 병합, worktree/브랜치 정리 |

## 참고 (에스컬레이션 처리)

Developer가 worktree에 Supabase 환경변수가 없고 `/admin`이 인증 게이트라 로컬 실브라우저 확인이 막힌다고 에스컬레이션했습니다. PM 판단으로 **Vercel 프리뷰 배포(실 프로덕션 빌드 + 실기기)** 에서 확인하는 경로를 택했고, 사용자가 프리뷰에서 확인 완료 후 병합했습니다. 이는 에픽 공통 규약("검증은 프로덕션 빌드로")에도 부합합니다.
