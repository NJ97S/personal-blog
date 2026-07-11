# Issue #10 — 마크다운 에디터 모바일 (작성 우선 + 미리보기 토글)

**Status:** ✅ Merged & closed
**Issue:** [#10](https://github.com/NJ97S/personal-blog/issues/10) · **PR:** [#16](https://github.com/NJ97S/personal-blog/pull/16) (squash → `cfd3fb7`)
**Epic:** 관리자 모바일 최적화 (milestone #1, 트래킹 #15) · **형제:** #11·#12·#13·#14

## What changed
관리자 글쓰기 화면의 마크다운 에디터(`@uiw/react-md-editor` 래퍼)가 `preview="live"` 고정이라 폰에서 반 폭으로 쪼개져 쓸 수 없던 문제를 해결.
- `components/MarkdownEditor.tsx`: `matchMedia('(max-width:767px)')`로 모바일 감지 → 폰은 `edit`(작성) 기본 + 토글로 `preview` 전환, 데스크톱(≥768px)은 기존 `live` 유지. hidden input `name` 계약·다크모드 동기화·`MarkdownView` 프리뷰 경로 보존.
- `components/useMarkdownScrollSync.ts`: `enabled` 인자 — live일 때만 활성, 단일 패널 전환 시 리스너·옵저버·mirror 완전 teardown.
- `app/globals.css`: `.markdown-editor-widget .w-md-editor*` 한정 모바일 규칙만 추가(툴바 가로 스크롤, area/preview 전체 폭). 기존 전역 스타일 불변.

## Verification
- `npm run lint`/`build` 통과.
- 프로덕션 빌드 실브라우저(로그인 후 `/admin/posts/new`, 폰 폭): 작성 단일 패널 + "미리보기" 토글 + 툴바 가로 스크롤 정상. (관리자 인증 게이트라 사용자가 직접 로그인해 확인.)

## Scope routing (Phase 4)
- 검증 중 발견한 **제목(`TitleInput`) 폰 잘림(축소+줄바꿈)** 은 #10 범위 밖(→ #11 소유)이라 흡수하지 않고 [#11에 코멘트](https://github.com/NJ97S/personal-blog/issues/11#issuecomment-4943126947)로 라우팅. `<input>`은 줄바꿈 불가 → #11에서 input→textarea 전환 여부 결정.

## Documents
- [plan.md](plan.md) — PM 계획
- [plan-review.md](plan-review.md) — fresh-eyes 계획 리뷰 (REVISE→PASS)
- [report.md](report.md) — Developer 구현 보고 (이탈 0, escalation: 인증 게이트로 브라우저 검증은 PM/사용자가 수행)
- [pr-review-r1.md](pr-review-r1.md) — fresh-eyes PR 리뷰 (APPROVE, findings 0)

## Lifecycle notes
- 계획 리뷰 1라운드 REVISE(ssr 표현/globals 펜스/스크롤싱크 teardown/프리뷰 렌더러 동일성) → 보강 후 PASS.
- Developer escalation(관리자 인증으로 브라우저 검증 불가)은 환경 이슈 → 사용자가 로그인해 실브라우저 확인, 코드 재작업 없음.
