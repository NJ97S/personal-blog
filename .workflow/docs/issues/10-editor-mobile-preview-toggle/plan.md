# Plan — Issue #10: 마크다운 에디터 모바일 (작성 우선 + 미리보기 토글)

- **Issue:** [#10](https://github.com/NJ97S/personal-blog/issues/10) · **Epic(milestone):** 관리자 모바일 최적화 (#15 트래킹)
- **형제 이슈:** #11 셸·하단바·입력 / #12 출간모달 / #13 글목록 / #14 카테고리트리
- **Owns:** `components/MarkdownEditor.tsx`, `components/useMarkdownScrollSync.ts`, `app/globals.css`(에디터 한정)

## Goal
관리자 글쓰기 화면의 마크다운 에디터(`@uiw/react-md-editor` 래퍼)가 현재 좌우 분할(`preview="live"`) 고정이라, 폰(~360–430px)에서 에디터와 미리보기가 각각 반 폭(~150px)으로 쪼개져 사실상 쓸 수 없다. 폰에서는 **작성 화면을 전체 폭으로** 보여주고 **버튼으로 미리보기를 토글**할 수 있게 하며, 툴바가 가로로 넘치지 않게 한다. 데스크톱(`md:`↑)의 기존 live 분할과 스크롤싱크는 그대로 유지한다. 변경은 에디터 위젯과 그 스크롤싱크 훅, 그리고 에디터 한정 전역 CSS에 한정된다.

## Scope Fence (Phase 1에서 확정)
**Must do**
- 폰에서 에디터를 좌우 분할 대신 작성 전체 폭 + 미리보기 토글 버튼.
- 툴바 가로 넘침 처리(래핑 또는 가로 스크롤).
- 데스크톱은 기존 live 분할 유지.
- 단일 패널 상태에서 스크롤싱크가 오작동/자원낭비 없이 inert.

**Must NOT touch**
- `PostEditorShell.tsx`, `NewPostForm.tsx`, `EditPostForm.tsx`, `TitleInput.tsx`, `TagInput.tsx` (→ #11)
- `PublishModal.tsx`(#12), `app/admin/posts/page.tsx`(#13), `CategoryAdmin.tsx`(#14)
- `MarkdownView.tsx`의 공개 측 렌더링 동작 (에디터/공개 공유)
- `globals.css`의 기존 전역 스타일(`.craft-*`/`.craft-prose*`/hljs/base) — 에디터 한정 규칙만 추가
- `MarkdownEditor`가 폼에 노출하는 계약(`name` 히든 인풋에 마크다운 문자열을 담는 것)은 유지 — 폼(#11)이 이에 의존

**Sequencing**
- 하드 의존 없음. #11보다 먼저 하면 통합이 매끄러움(권장).

## Approach

**채택: 클라이언트에서 뷰포트를 감지해 라이브러리 `preview` 모드를 전환 + 모바일 전용 미리보기 토글.**
`@uiw/react-md-editor`의 분할 여부는 `preview` prop("live"/"edit"/"preview")이라는 **JS prop으로 제어**된다(현재 "live" 고정). 따라서 폰에서는 작성 전용 모드로 렌더링하고, 토글 버튼으로 미리보기 전용 모드와 오간다. 데스크톱에서는 지금처럼 live 분할. 뷰포트 판정은 마운트 이후 클라이언트에서 수행한다(래퍼는 `'use client'`, 내부 `MDEditor`만 `ssr:false`로 로드되므로 SSR 불일치 위험이 없다). 툴바 넘침과 단일 패널 시각 보정은 에디터 한정 전역 CSS로 처리한다.

**기각한 대안**
- **CSS만으로 분할 접기:** 분할 여부가 JS prop이라 CSS로는 "미리보기 토글 버튼"과 모드 전환을 제대로 줄 수 없다. 프리뷰 패널을 CSS로 숨기는 편법은 스크롤싱크 훅이 여전히 두 패널을 붙잡으려 하고 토글 UX가 없어 요구사항 미충족.
- **에디터 라이브러리 교체:** 에픽 비목표. 과도한 변경.
- **모바일에서 미리보기 완전 제거(토글 없음):** 요구사항이 "작성 우선 + 미리보기 토글"이므로 미충족.

## Design decisions
1. **모드 전환은 JS 주도(뷰포트 감지), CSS-only 아님.** — *why:* 분할/단일은 라이브러리 `preview` prop으로만 바뀌며(현재 `MarkdownEditor`가 "live"로 고정), 요구된 "미리보기 토글 버튼"도 상태가 필요하다. 래퍼 `MarkdownEditor`는 `'use client'` 클라이언트 컴포넌트이고 내부 `MDEditor`만 `dynamic(ssr:false)`로 로드된다 — 어느 쪽이든 뷰포트 감지는 마운트 이후 클라이언트에서 하므로 SSR/하이드레이션 불일치가 없다.
2. **데스크톱은 현행 유지, 모바일만 변경.** — *why:* 스크롤싱크 훅은 `.w-md-editor-area`와 `.w-md-editor-preview` 두 패널이 동시에 존재해야 동작하는데, 넓은 화면에서는 분할이 유용하고 문제는 폰에서만 발생한다. 브레이크포인트는 Tailwind `md`(≈768px) 기준 권장(폰=단일, 그 이상=분할).
3. **단일 패널에서 스크롤싱크는 확실히 비활성 + 깨끗한 teardown.** — *why:* 스크롤싱크 훅은 `.w-md-editor-area`와 `.w-md-editor-preview` 두 패널을 모두 찾아 attach하는 구조라 데스크톱 live에서만 의미가 있다. 요구 동작(WHAT): **훅/컨트롤러는 데스크톱 live(두 패널 존재)에서만 활성화**되고, 모바일 단일 패널로 전환되면 그때까지 붙어 있던 스크롤 리스너·ResizeObserver·MutationObserver·바디에 붙는 off-screen 미러 DOM이 **모두 정리(teardown)** 되어야 한다. 모드를 오가도 옵저버/미러가 누적되거나 스크롤 튐이 남지 않아야 한다. (구체 구현은 Developer 재량 — 예: live일 때만 훅을 돌리거나 전환 시 컨트롤러를 destroy.)
4. **모바일 미리보기도 기존 커스텀 프리뷰 렌더러 경로 유지.** — *why:* 현재 에디터는 `MarkdownView`(compact + annotateLines) 기반 커스텀 프리뷰 렌더러로 미리보기를 그린다. 모바일 미리보기 전용 모드도 **같은 렌더러 경로를 써서** 데스크톱 미리보기와 시각적으로 동일해야 하고, 별도 프리뷰 경로를 새로 만들지 않는다.
5. **툴바 넘침은 에디터 한정 전역 CSS로.** — *why:* `globals.css`에 `.w-md-editor` 관련 규칙이 하나도 없음(확인함; 다만 `.craft-prose*` 계열 프리뷰 스타일은 이미 존재). 라이브러리 기본 툴바는 좁은 화면에서 래핑되지 않으므로 **`.w-md-editor` 모바일 보강 규칙만 신규 추가**하고, 기존 `.craft-prose*`/`.craft-*`/hljs/base 등 전역 스타일은 수정하지 않는다.
6. **폼 계약 유지.** — *why:* 폼(#11 소유)은 `MarkdownEditor`의 `name` 히든 인풋으로 마크다운을 제출한다. 모바일 대응이 이 인터페이스를 바꾸면 폼이 깨진다.

## Constraints
- 클라이언트 전용(`'use client'`, `dynamic(ssr:false)`) 유지, 폼 제출용 `name`/`value` 계약 불변.
- 기존 다크모드 동기화(`<html>.dark` 감시)가 모드 전환과 무관하게 계속 동작.
- 데스크톱 live 분할·스크롤싱크 동작·시각은 변경 없음(폰 브레이크포인트 아래에서만 조정).
- 크래프트 디자인 토큰/기존 전역 스타일 보존.

## Edge cases
- **뷰포트 리사이즈/회전으로 브레이크포인트 교차:** 모드가 전환되며 작성 중 내용(`value`)이 유지되어야 한다.
- **모바일에서 작성↔미리보기 토글 중 타이핑 내용 보존.**
- **하이드레이션:** 에디터가 `ssr:false`라 서버/클라 불일치 없음. 뷰포트 판정은 마운트 후.
- **다크모드 토글을 모바일 미리보기 상태에서 수행.**
- **아주 긴 코드/표를 모바일 미리보기로 볼 때:** 미리보기 내부 스크롤/오버플로는 `MarkdownView`가 이미 처리(공개 측과 공유, 동작 변경 없음).

## Non-goals
- 하단 고정 액션바·에디터 height(`calc(100vh - 260px)`) 대응 → **#11**.
- 출간 모달 → #12, 글 목록 → #13, 카테고리 트리 → #14.
- `MarkdownView`의 공개 측 렌더링 변경.
- 에디터 라이브러리 교체(에픽 비목표).
- 데스크톱 분할/스크롤싱크 동작·시각 변경.

## Acceptance
- 폰 폭에서 에디터가 단일 컬럼(작성)로 뜨고, 토글 버튼으로 미리보기 전용과 오갈 수 있다.
- 데스크톱(`md:`↑)에서는 기존 live 분할이 그대로 유지된다.
- 툴바가 화면 밖으로 깨지지 않는다(래핑 또는 가로 스크롤).
- 단일 패널일 때 스크롤싱크로 인한 튐/자원낭비가 없다.
- 다크모드·폼 제출·데스크톱 동작에 회귀가 없다.
- `npm run lint`/`build` 통과, 프로덕션 빌드(`next build && next start`) 실브라우저 확인(개발 모드는 CSP로 하이드레이션 실패하므로 사용하지 않음).
