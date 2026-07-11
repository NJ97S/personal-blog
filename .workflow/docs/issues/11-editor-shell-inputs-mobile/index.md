# Issue #11 — 에디터 셸·하단 액션바·입력 모바일

**Status:** ✅ Merged & closed
**Issue:** [#11](https://github.com/NJ97S/personal-blog/issues/11) · **PR:** [#17](https://github.com/NJ97S/personal-blog/pull/17) (squash → `94c3dab`)
**Epic:** 관리자 모바일 최적화 (milestone #1, 트래킹 #15) · **형제:** #10(머지)·#12·#13·#14

## What changed
관리자 글쓰기/편집 화면의 에디터 페이지 크롬을 폰(~360–430px) 대응.
- `components/TitleInput.tsx`: `<input>` → auto-grow `<textarea>`. 긴 제목 소프트랩(전체 노출), Enter/붙여넣기 개행은 공백 정규화(제출 값에 하드 개행 없음), 폰 `text-2xl`→`sm:text-4xl`. `name`/`required`/`onBlur`(slug) 유지.
- `components/PostEditorShell.tsx`: 하단 고정 바 폰에서 `flex-wrap justify-between` 단일 행 + `env(safe-area-inset-bottom)`, 본문 하단 예약 정합. `sm:`↑ 기존.
- 두 폼(New/Edit): 액션 버튼 모바일 터치 높이(≈44px), 에러메시지는 CSS `order`로 버튼 위 전체폭 행, 에디터 `height` 모바일 `max(320px, calc(100dvh - 22rem))`/데스크톱 기존값(MarkdownEditor prop 인터페이스 불변). "이 글 삭제" 터치 크기.
- `components/TagInput.tsx`: 태그 제거 버튼 모바일 히트 영역 확대.

## Lifecycle
- 계획 리뷰 (P5): **PASS** (보강: onBlur 타입/붙여넣기 개행/PublishModal-외부-form 계약).
- 구현 (P6): `108dbf4` 이탈 0.
- **실브라우저 검증 중 사용자 피드백** → 모바일 하단 바가 세로 스택(나가기 단독 중앙)이라 어색 → [directive-r1](directive-r1.md)로 "데스크톱처럼 단일 행" 재배치 지시 → `c4e78d3`. 제목 잘림(#10에서 라우팅해 온 요구)도 이 이슈에서 해결.
- PR 리뷰 (P8): **APPROVE** (findings 0). Vercel pass.

## Documents
- [plan.md](plan.md) · [plan-review.md](plan-review.md) (PASS) · [report.md](report.md) (Developer) · [directive-r1.md](directive-r1.md) (하단 바 재배치 지시) · [pr-review-r1.md](pr-review-r1.md) (APPROVE)

## Notes
- 관리자 인증 게이트라 실브라우저 검증은 사용자가 로그인해 수행(프로덕션 빌드 :3020).
- #10에서 라우팅된 "제목 축소+줄바꿈"이 여기서 처리됨(#11 코멘트 참조).
