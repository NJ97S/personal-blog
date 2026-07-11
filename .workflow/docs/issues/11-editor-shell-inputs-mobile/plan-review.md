**Design Premises**

거짓 전제는 발견하지 못했습니다. 주요 전제는 실제 코드와 일치합니다.

- `PostEditorShell`은 고정 하단 액션바와 본문 하단 예약 공간을 소유합니다. `components/PostEditorShell.tsx:9`에 `pb-[96px]`, `:10-11`에 `fixed inset-x-0 bottom-0` 및 `flex items-center justify-between gap-3`가 있어, 계획의 “폰에서 액션바 넘침/안전영역/본문 예약 공간 정합” 전제는 맞습니다.
- 신규/편집 폼의 액션 슬롯은 실제로 “나가기 / 에러메시지 / 임시저장 / 출간하기”를 한 줄 구조로 넘깁니다. `app/admin/posts/new/NewPostForm.tsx:108-131`, `app/admin/posts/[id]/edit/EditPostForm.tsx:138-161`에서 확인됩니다. 특히 에러 메시지가 우측 버튼 클러스터 안에 있어 모바일 넘침 원인이 될 수 있다는 계획 전제도 타당합니다.
- 에디터 높이는 양쪽 폼에서 `MarkdownEditor`에 `height="calc(100vh - 260px)"`로 전달됩니다. 신규 폼은 `NewPostForm.tsx:138`, 편집 폼은 `EditPostForm.tsx:168`입니다. `MarkdownEditor`의 prop 타입도 `number | string`이고 그대로 `MDEditor`에 전달됩니다(`components/MarkdownEditor.tsx:17-21`, `:88-92`). “height 값만 조정 가능, prop 인터페이스 유지” 방향은 코드와 맞습니다.
- #10 이후 모바일 미리보기 토글이 `MarkdownEditor` 내부에 존재합니다. `components/MarkdownEditor.tsx:30-33`, `:66-87`에서 `isMobile`일 때 작성/미리보기 토글이 렌더링됩니다. 계획이 상단 요소 높이에 이 토글을 포함한 것도 맞습니다.
- `TitleInput`은 현재 `<input type="text">`이며 한 줄 입력입니다. `components/TitleInput.tsx:21-30`에서 확인됩니다. 따라서 “전체 제목 노출을 위해 textarea 전환” 판단의 출발점은 맞습니다.
- 제목 제출 계약은 `name="title"`에 의존합니다. `TitleInput` 기본값은 `name = 'title'`(`components/TitleInput.tsx:13`)이고 서버 액션은 `formData.get('title')`을 읽습니다(`app/actions/posts.ts:65-67`). 계획이 `name`, `required`, 신규 폼 `onBlur` slug 자동생성을 보존해야 한다고 한 것은 정확합니다.
- 태그 제거 버튼은 실제로 작은 히트 영역입니다. `components/TagInput.tsx:62-68`의 버튼은 `h-4 w-4`, 아이콘은 `h-3 w-3`입니다. hidden field는 `tags.join(',')`(`:55`)이고 서버 액션은 콤마 문자열을 split합니다(`app/actions/posts.ts:70`, `:85-90`).
- 편집 폼의 dangerZone 삭제 버튼은 `EditPostForm.tsx:126-133`에서 만들어지고 `PublishModal` prop으로 전달됩니다(`:172-181`). `PublishModal` 내부에서는 단순 slot으로 렌더링됩니다(`components/PublishModal.tsx:268-271`). “폼이 넘기는 dangerZone 삭제 버튼 마크업만 조정”은 범위상 가능하고 모달 내부 레이아웃 변경 없이 처리할 수 있습니다.
- 프로덕션 빌드로 브라우저 검증하라는 전제도 근거가 있습니다. `next.config.mjs:8`의 CSP `script-src`에는 `unsafe-eval`이 없어서 Next dev 환경과 충돌할 수 있습니다.

**Gaps Discovered**

- Should document — `TitleInput`을 `<textarea>`로 바꾸면 prop 타입도 같이 바뀌어야 합니다. 현재 `onBlur` 타입은 `React.FocusEvent<HTMLInputElement>`입니다(`components/TitleInput.tsx:8`). textarea 전환 시 `React.FocusEvent<HTMLTextAreaElement>` 또는 더 일반적인 타입으로 바꾸지 않으면 TypeScript 오류가 납니다. Developer가 코드 탐색으로 바로 발견할 수준이라 blocking은 아닙니다.
- Should document — “Enter 억제”만으로는 붙여넣기 개행이 막히지 않습니다. 계획의 Edge cases에는 붙여넣기 개행 방지가 들어 있지만, Design decision 1은 Enter 억제만 명시합니다. 실제 요구는 제출 제목에 하드 개행이 없어야 하므로 `onChange` 또는 `onPaste`에서 CR/LF 정규화까지 필요합니다. 계획 본문에 이미 edge case가 있어 blocking은 아니지만 구현자가 놓치기 쉬운 부분입니다.
- Should document — `PublishModal`의 submit 버튼들은 현재 외부 `<form>` 안에 남아 있어 폼 제출이 동작합니다. 양쪽 폼은 `<form>`이 `PostEditorShell`과 `PublishModal`을 모두 감쌉니다(`NewPostForm.tsx:107-149`, `EditPostForm.tsx:137-183`). #12를 피하려고 구조를 옮기다가 모달이 form 밖으로 나가면 출간 submit 계약이 깨집니다. 계획이 “prop 인터페이스 유지”는 말하지만 form containment까지 명시하지는 않습니다.
- Observation — `app/globals.css:108-133`에는 이미 #10 범위의 모바일 에디터 내부 CSS가 있습니다. 이번 계획이 이를 건드리지 않고 폼/셸에서 해결하려는 방향은 범위 펜스와 맞습니다.
- Observation — `PostEditorShell`은 파일 자체에 `'use client'`가 없지만 현재 클라이언트 폼에서 import되어 쓰입니다. 이번 작업에서 셸에 viewport 측정 같은 hook을 넣는다면 명시적으로 클라이언트 컴포넌트화될 수 있습니다. 전략상 문제는 아니지만 변경 시 의도적으로 판단해야 합니다.

**Design Review**

전략 방향은 타당합니다. 문제의 실제 원인이 셸의 고정 바, 두 폼의 액션 슬롯 구조, 제목 입력 컴포넌트, 태그 chip 버튼, 폼에서 전달하는 editor height 값에 모여 있으므로 계획의 소유 파일 안에서 해결 가능합니다.

기존 패턴과도 크게 어긋나지 않습니다. 관리자 글쓰기 페이지는 이미 클라이언트 폼이 상태와 Server Action 제출을 소유하고, `TitleInput`/`TagInput`/`MarkdownEditor`/`PublishModal`을 조립하는 구조입니다. 계획은 이 조립 레벨에서 모바일 크롬을 보정하고, `MarkdownEditor` 내부나 `PublishModal` 내부로 문제를 밀어 넣지 않습니다.

`TitleInput`의 textarea 전환도 요구사항상 합리적입니다. `<input>` 유지 + truncate는 “전체 노출” 요구를 만족하지 못하고, CSS만으로 input 텍스트를 soft-wrap할 수 없습니다. 다만 값 정규화와 타입 변경은 구현 시 반드시 같이 따라가야 합니다.

에디터 높이는 “상단 요소 높이에 관계없이 액션바와 겹치지 않게”라는 목표가 맞지만, 구체 해법은 개발자 재량으로 남겨도 됩니다. 현재 `MarkdownEditor`가 `height` 문자열을 받는 구조라 `100dvh`, safe area, 액션바 예약 공간 등을 폼/셸에서 조합할 여지가 있습니다. 새 추상화를 만들 필요는 없어 보입니다.

**Implementer Readiness**

대체로 구현 준비가 된 계획입니다. 무엇을 바꿀지, 무엇을 건드리지 말아야 하는지, 왜 textarea 전환이 필요한지, 왜 `MarkdownEditor`/`PublishModal` 내부를 피해야 하는지 설명되어 있습니다. capable Developer가 이 계획을 읽고 코드 탐색을 하면 구현 범위와 위험 지점을 이해할 수 있습니다.

보강하면 좋은 점은 세 가지입니다. `TitleInput`의 `onBlur` 타입 변경, 붙여넣기 개행 정규화, `PublishModal`이 현재 외부 form 안에 있어 submit 계약이 유지된다는 점을 구현 노트로 추가하면 시행착오가 줄어듭니다. 하지만 이들은 전략 오류가 아니라 구현상 주의사항입니다.

**Scope Fence Compliance**

Scope Fence는 내부적으로 일관됩니다.

- Must do 항목은 계획의 Approach/Design decisions/Acceptance에 모두 반영되어 있습니다. 하단 액션바 재배치와 safe area, editor height 조정, 제목 모바일 축소 및 soft-wrap, 태그 삭제/dangerZone 터치 타깃 확대, 데스크톱 보존이 모두 포함되어 있습니다.
- Must NOT touch 항목도 지켜지고 있습니다. 계획은 `MarkdownEditor.tsx`/`useMarkdownScrollSync.ts` 내부 변경을 피하고 height 값만 조정하도록 제한합니다. `PublishModal.tsx` 내부 레이아웃도 건드리지 않고 dangerZone으로 넘기는 삭제 버튼 마크업만 바꾸는 방향입니다. `app/admin/posts/page.tsx`, `CategoryAdmin.tsx`, 서버 액션 변경도 non-goal로 명시되어 있습니다.
- 형제 이슈 영역과 충돌하는 blocking gap은 없습니다. #10/#12/#13/#14 영역은 명확히 제외되어 있습니다.

**Verdict: PASS**