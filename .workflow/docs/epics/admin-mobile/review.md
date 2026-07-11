**Coverage Gaps**

없음. 5개 이슈의 합집합이 에픽 목표의 주요 표면을 모두 덮는다.

- 에디터 단일 컬럼/미리보기 토글/툴바/스크롤싱크는 Issue A가 `components/MarkdownEditor.tsx`, `components/useMarkdownScrollSync.ts`로 커버한다. 실제 코드도 `preview="live"`와 무조건 `useMarkdownScrollSync(rootRef, value)` 호출 구조라 이 컷이 맞다.
- 에디터 셸, 하단 액션바, 제목/태그 입력, 에디터 높이 매직넘버는 Issue B가 커버한다. 실제로 `PostEditorShell.tsx`의 `pb-[96px]`, fixed bottom bar, `NewPostForm.tsx`/`EditPostForm.tsx`의 `height="calc(100vh - 260px)"`, `TitleInput.tsx`의 `text-4xl`, `TagInput.tsx`의 `h-4 w-4`가 문제 지점이다.
- 출간 모달 스크롤/배경 잠금/모달 내부 컨트롤은 Issue C가 `components/PublishModal.tsx`로 커버한다. 실제 모달은 `w-[880px] max-w-[95vw]`만 있고 `max-height`/`overflow-y`/body scroll lock이 없다.
- 글 목록 헤더와 긴 제목 행 truncation은 Issue D가 `app/admin/posts/page.tsx`로 커버한다.
- 카테고리 트리 터치 타깃과 들여쓰기는 Issue E가 `app/admin/categories/CategoryAdmin.tsx`로 커버한다.

**Dependency Review**

순환 없음. 문서상 하드 의존이 없고, 실제 소유 파일도 분리되어 있어 DAG는 성립한다.

거짓 의존은 보이지 않는다. A→B는 “권장 순서”로만 표시되어 있고 하드 의존으로 선언하지 않은 판단이 맞다. B는 `MarkdownEditor`의 호출부 height prop을 조정하지만, A가 내부 모바일 렌더링을 고쳐도 현재 prop 계약을 유지하면 독립 구현 가능하다.

누락된 하드 의존도 보이지 않는다.

- B와 C는 둘 다 편집 화면 경험에 관여하지만 파일 경계가 명확하다. B는 `EditPostForm.tsx`의 `dangerZone` 버튼 마크업을 소유하고, C는 `PublishModal.tsx`의 슬롯 배치/스크롤 컨테이너를 소유한다.
- C는 `categoryPicker` prop의 내용 자체를 바꾸지 않는다고 명시되어 있어 `CategoryPicker.tsx`와의 숨은 의존을 만들지 않는다. 현재 `CategoryPicker`는 기본 select 레이아웃이며 모달 컨테이너 폭/스크롤 보정만으로 수용 가능하다.

**Scope Conflicts**

중대한 소유권 충돌 없음.

- A와 B는 에디터 페이지를 함께 다루지만 A는 에디터 위젯 파일, B는 셸/폼/입력 파일을 소유한다.
- B와 C의 잠재 충돌 지점인 `dangerZone`은 “내용 마크업 = B, 슬롯 배치/스크롤 = C”로 잘 나뉘어 있다.
- D와 E는 각각 `/admin/posts` 목록 페이지와 `/admin/categories` 클라이언트 트리 컴포넌트라 겹치지 않는다.

주의점 하나: Issue A의 툴바 overflow 처리는 `@uiw/react-md-editor` 내부 클래스 스타일링이 필요할 수 있다. 문서상 A의 Owns에 `app/globals.css`가 없지만, `MarkdownEditor.tsx` 래퍼에 Tailwind arbitrary selector를 붙이는 방식으로 해결 가능하므로 반드시 충돌은 아니다. 구현자가 전역 CSS가 필요하다고 판단하면 decomposition 문서에 “A may touch editor-scoped rules in `app/globals.css` only” 정도를 추가하면 더 안전하다.

**Sizing**

각 이슈는 대체로 1 PR 크기다.

- Issue A는 에디터 모바일 모드, 토글 상태, 스크롤싱크 조건부 비활성, 툴바 overflow까지 포함해 가장 크지만 단일 컴포넌트 경계 안에 있어 review 가능하다.
- Issue B는 셸 + 두 폼 + 작은 입력 2개를 건드려 표면이 넓지만 모두 편집 화면 레이아웃에 묶여 있어 쪼갤 필요는 없다.
- Issue C, D, E는 각각 단일 파일 중심이라 적절하다.
- 너무 사소해서 합쳐야 할 이슈는 없다. D/E는 독립 admin 화면이라 분리 유지가 낫다.

**Codebase Grounding**

분해의 주요 코드 전제는 사실과 맞다.

- `app/admin/layout.tsx`는 children pass-through라 admin 전용 모바일 셸이 없다.
- `MarkdownEditor.tsx`는 `@uiw/react-md-editor`를 dynamic import하고 `preview="live"`를 고정 사용한다.
- `useMarkdownScrollSync.ts`는 `.w-md-editor-area`와 `.w-md-editor-preview` 양쪽 DOM이 있다는 전제로 동작한다.
- `PublishModal.tsx`는 focus trap과 Esc는 있지만 body scroll lock은 없다. 공개 모바일 drawer인 `CategoryDrawer.tsx`에는 `document.body.style.overflow = 'hidden'` 패턴이 실제로 있다.
- `PostEditorShell.tsx`, `NewPostForm.tsx`, `EditPostForm.tsx`, `TitleInput.tsx`, `TagInput.tsx`, `app/admin/posts/page.tsx`, `CategoryAdmin.tsx`의 문제 지점은 문서 설명과 일치한다.
- 단, `app/globals.css`에는 `.craft-prose-compact`가 이미 있어 “에디터 관련 전역 CSS가 전혀 없다”는 표현은 엄밀히는 과하다. 하지만 `.w-md-editor` 자체를 접거나 툴바 overflow를 제어하는 규칙은 없으므로 decomposition 결론에는 영향 없다.

**Verdict**

PASS — decomposition은 현재 코드베이스에 잘 접지되어 있고, 5개 이슈의 합집합이 에픽 목표를 전달한다. GitHub 이슈 생성 전에 선택적으로 Issue A에 editor-scoped `app/globals.css` 수정 허용 문구만 보강하면 더 견고하다.