**Design Premises**

- 거짓 전제는 발견하지 못했습니다. 계획의 핵심 전제는 코드와 일치합니다.
- `components/PublishModal.tsx`는 `createPortal` 없이 두 관리자 폼 내부에서 인라인 렌더됩니다. `app/admin/posts/new/NewPostForm.tsx`와 `app/admin/posts/[id]/edit/EditPostForm.tsx` 모두 `<form>`이 `PostEditorShell`과 `PublishModal`을 함께 감싸고, 모달의 출간 버튼은 `type="submit"`입니다. 따라서 포털 이동을 피해야 한다는 계획의 판단은 맞습니다.
- `components/PublishModal.tsx`의 다이얼로그 프레임에는 현재 `max-height`나 `overflow-y`가 없습니다. 본문은 `grid grid-cols-1 ... md:grid-cols-2`라 모바일에서 세로로 길어지고, `dangerZone`과 하단 취소/출간 버튼은 본문 뒤에 이어집니다. 모바일에서 하단에 도달하지 못할 수 있다는 전제는 맞습니다.
- `PublishModal`에는 이미 `useFocusTrap<HTMLDivElement>(open)`과 `open` 기반 Esc 처리 effect가 있습니다. 스크롤 래퍼를 추가해도 포커스 가능한 요소가 같은 dialog container 하위에 있으면 포커스 트랩 전제는 유지됩니다.
- `components/CategoryDrawer.tsx`는 `open` 동안 `document.body.style.overflow = 'hidden'`을 설정하고 cleanup에서 `''`로 되돌립니다. PublishModal의 배경 잠금에 이 패턴을 재사용한다는 전제는 코드베이스 패턴과 일치합니다.
- `dangerZone`은 현재 수정 폼에서만 전달되고 신규 폼에서는 전달되지 않습니다. `EditPostForm.tsx`는 삭제 버튼을 만들어 `dangerZone` prop으로 넘기고, `NewPostForm.tsx`는 넘기지 않습니다. 선택적 슬롯으로 다뤄야 한다는 전제는 맞습니다.
- 계획의 “categoryPicker로 넘어오는 시리즈 선택 UI”라는 표현은 코드상 정확하지 않습니다. 실제 prop은 `CategoryPicker`가 렌더하는 카테고리 `<select name="categoryId">`입니다. 다만 계획의 의도는 “넘어온 노드의 내용 마크업은 건드리지 않는다”이므로 전략 오류는 아닙니다.

**Gaps Discovered**

- Should document — `dangerZone`이 스크롤 가능한 영역에 포함되는지 명시하면 좋습니다. 계획은 “상단 필드부터 dangerZone·하단 버튼까지 도달”을 Must do로 말하지만, Approach에서 “헤더/푸터 고정 + 가운데 본문만 스크롤”도 권장합니다. 구현자가 가운데 본문을 현재 grid 영역만으로 해석하면 `dangerZone`이 스크롤 영역 밖에 남을 수 있습니다. `components/PublishModal.tsx`에서 `dangerZone`은 grid 뒤, footer 앞에 있으므로, 본문-only 스크롤 구조를 택할 경우 `dangerZone`까지 그 스크롤 컨테이너 안에 넣거나 별도 접근성을 보장해야 합니다.
- Should document — body scroll lock은 현재 `CategoryDrawer`처럼 단순히 `document.body.style.overflow = ''`로 원복하는 패턴입니다. 이 앱에서는 충분하지만, 기존 inline overflow 값을 보존하지는 않습니다. 계획이 “기존 패턴 재사용”을 명시하므로 blocking은 아니며, 구현자가 새 일반화 훅을 만들 필요도 없습니다.
- Observation — `PublishModal`은 닫힘 상태에서도 DOM에 남고 `opacity-0 pointer-events-none` 및 `aria-hidden={!open}`로 비활성화됩니다. 계획은 조건부 마운트 전환을 요구하지 않고, `open` guard가 있는 effect를 추가하는 방향이라 현재 구조와 충돌하지 않습니다.
- Observation — #11 별도 worktree는 `PublishModal.tsx`를 변경하지 않고 `EditPostForm.tsx`의 `dangerZone` 버튼 마크업만 조정합니다. 계획의 “소유 파일이 겹치지 않는다”는 Sequencing 판단은 현재 worktree 기준으로도 맞습니다.

**Design Review**

전략은 코드베이스의 기존 구조와 잘 맞습니다. 이 작업은 `components/PublishModal.tsx` 내부의 레이아웃/스크롤/배경 잠금 문제이고, 호출부의 폼 계약이나 서버 액션을 바꿀 필요가 없습니다. 특히 포털 전환을 배제한 판단이 중요합니다. 현재 submit 버튼은 외부 `<form>` containment에 의존하므로, 포털로 옮기려면 `form` attribute나 호출부 변경이 필요해지고 Scope Fence를 깨게 됩니다.

기존 패턴 재사용도 적절합니다. `CategoryDrawer`의 body overflow lock, `useFocusTrap`, 손으로 만든 Esc listener가 이미 코드베이스의 modal/drawer 패턴입니다. PublishModal의 기존 Esc effect 수명주기에 body lock cleanup을 함께 두는 접근은 과한 추상화 없이 일관성을 유지합니다.

대안 검토도 타당합니다. 모바일 전용 바텀시트/풀스크린 시트는 에픽의 “반응형 보정, 신규 UX 신설 금지”와 어긋납니다. 중앙 모달을 유지하면서 viewport-bound scroll container로 만드는 것이 최소 변경입니다.

**Implementer Readiness**

구현 준비도는 충분합니다. 계획은 무엇을 바꾸는지(`PublishModal.tsx`), 무엇을 절대 바꾸지 않는지(호출부, prop 인터페이스, 서버 액션, 업로드 로직, slot content), 왜 포털을 피해야 하는지, 어떤 검증이 필요한지를 자체적으로 설명합니다.

보강하면 좋은 구현 노트는 하나입니다. 스크롤 구조를 정할 때 `dangerZone`의 위치를 반드시 포함해서 판단하라고 적으면 시행착오가 줄어듭니다. 하지만 Must do와 Acceptance가 이미 “dangerZone·하단 버튼까지 도달”을 요구하므로, capable Developer가 코드 탐색을 하면 충분히 도달 가능한 수준입니다.

**Scope Fence Compliance**

- Must do는 계획의 Goal, Approach, Edge cases, Acceptance에 모두 반영되어 있습니다. 내부 스크롤, body scroll lock, 모달 자체 컨트롤 터치 타깃, 데스크톱 보존, 포커스 트랩/Esc 유지, lint/build/프로덕션 브라우저 검증이 포함되어 있습니다.
- Must NOT touch도 지켜집니다. 계획은 `NewPostForm.tsx`/`EditPostForm.tsx` 호출부 변경을 배제하고, `dangerZone`/`categoryPicker` 내용 마크업과 prop 인터페이스, 업로드/서버 액션/제출 동작을 건드리지 않도록 제한합니다.
- 형제 이슈 #11과의 경계도 명확합니다. #11은 `dangerZone` 버튼 자체의 마크업을 소유하고, #12는 `PublishModal.tsx` 안에서 그 슬롯이 놓이고 스크롤되는 컨테이너만 소유합니다.
- Scope Fence 위반이나 Must deliver 누락은 없습니다.

Verdict: **PASS**