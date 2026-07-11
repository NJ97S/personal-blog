**Design Premises**

- 확인됨: 현재 모바일 문제의 직접 원인은 `components/MarkdownEditor.tsx`가 `MDEditor`에 `preview="live"`를 고정 전달하는 구조다. 실제 코드에서 `preview="live"`와 `enableScroll={false}`가 함께 지정되어 있고, 라이브러리 타입도 `preview`를 `'live' | 'edit' | 'preview'`로 정의한다. 따라서 모바일에서 `edit`/`preview`, 데스크톱에서 `live`로 JS prop을 전환한다는 방향은 코드와 맞다.

- 확인됨: `MarkdownEditor`는 Client Component이고, 내부 `@uiw/react-md-editor`만 `dynamic(..., { ssr: false })`로 로드된다. 계획 본문은 이 경계를 대체로 정확히 설명한다. 다만 Edge cases의 “에디터가 `ssr:false`”라는 표현은 엄밀히는 내부 `MDEditor`에만 해당한다. 전략 오류는 아니지만, 구현자는 초기 렌더에서 `window`를 직접 읽지 말고 마운트 후 뷰포트를 판정해야 한다.

- 확인됨: 스크롤싱크 훅은 두 패널이 동시에 있는 `live` 모드를 전제로 한다. `components/useMarkdownScrollSync.ts`는 `.w-md-editor-area`, `.w-md-editor-text-input`, `.w-md-editor-preview`를 모두 찾아야 attach하고, scroll listener, `ResizeObserver`, `MutationObserver`, off-screen mirror DOM을 만든다. 모바일 단일 패널에서 비활성/teardown이 필요하다는 계획 전제는 맞다.

- 확인됨: 커스텀 프리뷰 렌더러 유지 전제는 중요하고 코드와 일치한다. `MarkdownEditor`는 `components.preview` 슬롯에 `<MarkdownView content={source} compact annotateLines />`를 넣고, `MarkdownView`는 공개 글 페이지에서도 쓰인다. 과거 문서 `docs/editor-preview-parity-2026-05-09.md`도 작성 화면과 발행 화면의 렌더링 일치를 핵심 설계로 설명한다.

- 확인됨: 폼 제출 계약은 hidden input에 의존한다. `MarkdownEditor`가 `<input type="hidden" name={name} value={value} readOnly />`를 렌더하고, 새 글/수정 폼은 `MarkdownEditor name="content"`를 사용하며, `app/actions/posts.ts`는 `formData.get('content')`를 읽는다. 이 계약을 유지해야 한다는 계획은 타당하다.

- 확인됨: `app/globals.css`에는 현재 `.w-md-editor*` 보정 규칙이 없고, 기존 규칙은 `.craft-card`, `.craft-prose`, `.craft-prose-compact`, hljs/code 스타일 중심이다. 에디터 한정 규칙만 추가한다는 경계는 실제 CSS 구조와 맞다.

**Gaps Discovered**

- Should document: `useMarkdownScrollSync`를 “live일 때만 훅을 돌린다”는 예시는 React hooks 규칙상 오해 소지가 있다. 조건부 hook 호출 대신 `enabled` 인자를 훅에 추가하거나, live 전용 하위 컴포넌트로 분리하거나, 훅 내부 effect가 enabled 변화에 따라 controller를 생성/파괴하도록 해야 한다. 계획의 teardown 요구는 충분하지만 구현자가 이 표현을 그대로 따르면 hook 규칙 위반이 날 수 있다.

- Should document: `@uiw/react-md-editor` 기본 툴바에는 `codeEdit`, `codeLive`, `codePreview` extra commands가 포함된다. 모바일에서 별도 토글 버튼을 추가할 때 이 기본 preview 모드 버튼들이 중복되거나 “live” 버튼을 노출할 수 있다. prop이 controlled라 최종 모드는 wrapper 상태로 돌아가겠지만, UX 혼선을 줄이려면 모바일에서 기본 preview commands를 숨기거나 wrapper 토글과 역할을 정리해야 한다.

- Observation: 라이브러리 CSS는 이미 `.w-md-editor-toolbar { flex-wrap: wrap; }`를 갖고 있지만, 툴바가 두 개의 `ul` 그룹으로 나뉘고 버튼/구분선이 많아 좁은 폭에서 여전히 overflow 보정이 필요할 수 있다. 계획의 “래핑 또는 가로 스크롤” 수용 기준은 이 구조와 충돌하지 않는다.

- Observation: `visibleDragbar` 기본값은 true이고 현재 `MarkdownEditor`에서 끄지 않는다. 모바일 단일 패널에서도 드래그바가 남을 수 있지만, Issue #11이 height/action bar를 소유하므로 이 이슈에서 반드시 다룰 차단 요소는 아니다.

**Design Review**

전략은 적절하다. 이 문제는 CSS로 좌우 패널을 숨기는 것보다 `preview` prop을 `edit`/`preview`/`live`로 제어하는 쪽이 라이브러리의 실제 모델과 맞다. 데스크톱 `live`를 유지하고 모바일에서만 단일 패널을 쓰는 방향도 blast radius가 작다.

기존 코드베이스의 중요한 패턴인 `MarkdownView` 공유 렌더러를 유지하는 결정도 맞다. 모바일 preview 전용 렌더러를 새로 만들면 작성 미리보기와 공개 렌더링 parity가 깨질 수 있는데, 계획은 이를 명확히 피한다.

추가 추상화는 필요 없어 보인다. `MarkdownEditor` 내부에서 viewport 상태와 모바일 preview 상태를 관리하고, `useMarkdownScrollSync`에 명시적 enable/disable 수명주기를 추가하는 정도가 현재 코드 구조에 가장 자연스럽다. `globals.css` 변경도 `.w-md-editor*`에 한정하면 공개 페이지 영향 없이 해결 가능하다.

**Implementer Readiness**

구현자는 이 계획만 읽고도 무엇을 바꿔야 하는지 이해할 수 있다. 특히 왜 CSS-only가 부족한지, 왜 공개 `MarkdownView` 동작을 건드리면 안 되는지, 왜 스크롤싱크 teardown이 필요한지, 폼 계약을 왜 유지해야 하는지가 설명되어 있다.

보강하면 좋은 점은 두 가지다. 첫째, hook enable/disable은 조건부 hook 호출이 아니라 effect/controller 수명주기로 구현해야 한다는 문장을 넣으면 실수를 줄일 수 있다. 둘째, 모바일 토글과 라이브러리 기본 preview toolbar commands의 관계를 명시하면 UX 중복을 피하기 쉽다. 둘 다 구현자가 코드 탐색 중 발견할 수 있는 수준이며, 현재 계획을 막을 정도는 아니다.

**Scope Fence Compliance**

- Must do 항목은 모두 계획에 포함되어 있다: 모바일 작성 전체 폭 + 미리보기 토글, 툴바 overflow 처리, 데스크톱 live 유지, 단일 패널 스크롤싱크 inert/teardown.

- Must NOT touch 위반은 없다. 계획은 `PostEditorShell.tsx`, `NewPostForm.tsx`, `EditPostForm.tsx`, `TitleInput.tsx`, `TagInput.tsx`, `PublishModal.tsx`, `app/admin/posts/page.tsx`, `CategoryAdmin.tsx`, 공개 `MarkdownView` 동작을 명시적으로 제외한다.

- `app/globals.css`는 에디터 한정 규칙만 추가한다는 조건으로 fence와 일치한다. 기존 `.craft-*`, `.craft-prose*`, hljs/base 규칙을 수정하지 않는다는 제한도 실제 파일 구조상 타당하다.

**Verdict: PASS**