# Issue #8 — SeriesBox 기본값을 접힘(앞 5개 미리보기)으로 변경

**Status:** ✅ Merged & closed
**Issue:** [#8](https://github.com/NJ97S/personal-blog/issues/8) · **PR:** [#9](https://github.com/NJ97S/personal-blog/pull/9) (squash-merged, `88da3b6`)
**Type:** standalone (no milestone/epic) · **Owns:** `components/SeriesBox.tsx`

## What changed
글 상세 페이지 상단의 같은-카테고리 글 목록(`SeriesBox`)이 카테고리 공개글 전체를 기본 펼침으로 노출해, 글이 많은 카테고리에서 이 섹션이 길어지던 문제를 해결했다.

- 기본 상태: 펼침 → **접힘** (초기 "펼치기" 버튼 노출).
- 접힘 시 전달받은 순서(오래된→최신) **앞에서 최대 5개**만 미리보기.
- "펼치기" → 전체 노출("숨기기" 전환) → 다시 접기 가능.
- 카테고리 공개글 **5개 이하면 토글 버튼을 렌더링하지 않음**.
- 하단 `n/total` 위치 인디케이터는 모든 경우 유지.
- 서버 쿼리(`app/posts/[slug]/page.tsx`)는 불변 — 전량 전달받아 클라이언트에서 slice.

## How it was decided (for the next reader)
- **왜 클라이언트 slice인가:** 부모 페이지가 이미 카테고리 공개글 전체 배열을 `SeriesBox`에 넘기므로, 노출 개수 제한은 순수 렌더링 결정이라 서버 변경이 불필요했다. 서버에서 5개만 조회하는 대안은 펼치기 시 전체를 다시 받아야 해 기각.
- **왜 "앞 5개"인가:** 이슈 생성 인터뷰에서 확정(목록 앞 5개 / 5개 이하 토글 숨김 / 클라이언트 slice). 현재 글이 앞 5개 밖이면 접힘 미리보기에 하이라이트가 안 보일 수 있으나 의도된 정책이며, `n/total`이 위치를 계속 표시한다.

## Verification
- `npm run lint` / `npm run build` 통과.
- 프로덕션 빌드 실브라우저 확인(23개 카테고리): 접힘 기본(앞 5개+"펼치기"+`n/23`), 펼침/접힘 리플로우, 현재 글 굵게, 2개 카테고리 토글 숨김 모두 정상.
- 참고: 개발 모드(`next dev`)에서는 Fast Refresh가 `eval`을 써서 이 앱의 엄격한 CSP(`script-src 'self' 'unsafe-inline'`, `unsafe-eval` 미허용)에 막혀 하이드레이션이 실패한다 — **개발 모드 전용 현상**이며 프로덕션과 이번 변경과는 무관. 검증은 `next build && next start`로 수행.

## Documents
- [plan.md](plan.md) — PM 계획 (목표·스코프 펜스·접근·설계 결정·엣지케이스)
- [plan-review.md](plan-review.md) — fresh-eyes 계획 리뷰 (Verdict: PASS)
- [report.md](report.md) — Developer 구현 보고 (변경/설계 결정/검증/에스컬레이션)
- [pr-review-r1.md](pr-review-r1.md) — fresh-eyes PR 리뷰 (Verdict: APPROVE, 0 findings)

## Lifecycle notes
- Developer 에스컬레이션 2건(브라우저 검증 env, report 렌더)은 모두 환경 이슈로 PM이 처리 — 코드 재작업 없음, 이탈 0건.
- squash 머지 후 로컬 main이 잠시 detached HEAD가 되어 `git checkout main && git merge --ff-only origin/main`으로 복구.
