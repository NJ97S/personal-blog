**Design Premises**

- 거짓 전제는 발견하지 못했습니다.
- `app/admin/categories/CategoryAdmin.tsx` 전제는 실제 코드와 일치합니다. `IconButton`은 `h-7 w-7`로 28px 터치 영역이고, 위/아래/편집/삭제 4개 버튼이 `flex items-center gap-1` 클러스터 안에 렌더됩니다. 행은 `flex items-center gap-2 px-3 py-2`이며 wrap이 없어 좁은 화면에서 이름 영역과 버튼 클러스터가 한 줄에서 경쟁합니다.
- `CategoryForm` 전제도 맞습니다. 같은 파일의 폼은 `grid grid-cols-1 ... md:grid-cols-[1fr_1fr_1fr_auto]`라 모바일에서 이미 단일 컬럼으로 스택됩니다.
- 트리 렌더 depth 전제도 맞습니다. `CategoryAdmin.tsx`는 루트, 자식, 손자까지만 `TreeRow`를 재귀 렌더하고 손자 아래는 `renderChild={() => null}`로 자릅니다. 따라서 렌더되는 최대 depth는 2이고 현재 inline padding 기준 최대 들여쓰기는 `12 + 2 * 20 = 52px`입니다.
- 데이터 모델 전제도 맞습니다. `lib/category-tree.ts`의 `buildTree`, `walkTree`, `collectDescendantIds`는 임의 깊이 트리를 만들고 순회할 수 있지만, 관리자 화면 렌더가 3단계로 제한합니다.
- `/admin/categories` 진입점 전제도 맞습니다. `app/admin/categories/page.tsx`는 `fetchCategoryTree()` 후 공개 `Layout` 안에 `CategoryAdmin`을 렌더하며, `Layout`은 `mx-auto w-full max-w-[1440px] px-4`와 반응형 grid를 갖습니다.
- 서버 액션 경계 전제도 맞습니다. `app/actions/categories.ts`는 create/update/delete/reorder와 revalidation을 담당하고, 이 이슈의 목표인 터치 영역 및 행 레이아웃 보정에는 변경이 필요하지 않습니다.
- 검증 전제도 근거가 있습니다. `next.config.mjs`의 CSP `script-src`에는 `unsafe-eval`이 없고, 에픽 문서도 `next dev` 대신 `next build && next start` 기반 실브라우저 확인을 요구합니다.

**Gaps Discovered**

- Should document: 폰 한정 들여쓰기 축소를 실제로 선택할 경우, 현재 들여쓰기는 `TreeRow`의 `style={{ paddingLeft: 12 + depth * 20 }}` inline style입니다. Tailwind `md:` padding 유틸리티만 같은 `<li>`에 추가하면 inline style이 우선해 기대한 responsive padding 조정이 안 될 수 있습니다. 계획은 들여쓰기 축소를 선택 사항으로 두고 있어 blocking은 아니지만, 구현자가 이 경로를 택한다면 inline style 구조를 의식해야 합니다.
- Observation: `app/admin/categories/CategoryAdmin.tsx`는 현재 이 화면 전용 컴포넌트입니다. `rg` 기준 `CategoryAdmin`, `TreeRow`, `IconButton`, `CategoryForm`은 이 파일 내부와 `page.tsx` 진입점 외에 재사용되지 않습니다. 따라서 단일 파일 스타일 보정의 blast radius는 작습니다.
- Observation: `fetchCategoryTree`, `walkTree`, `collectDescendantIds`는 공개 카테고리 페이지, sitemap, 태그/홈/포스트 상세 등에서도 쓰입니다. 하지만 계획이 해당 유틸이나 서버 액션을 건드리지 않도록 제한하므로 이 연결망은 위험으로 확장되지 않습니다.

**Design Review**

계획의 전략은 코드베이스 패턴과 잘 맞습니다. 이 앱의 관리자 모바일 에픽은 공용 admin shell을 새로 만드는 대신, 각 화면의 깨지는 지점에 Tailwind 반응형 프리픽스와 최소한의 레이아웃 보정만 추가하는 방향입니다. `CategoryAdmin.tsx`의 문제도 정확히 행 내부 flex 계약과 버튼 크기 문제라서 새 상태, 새 컴포넌트, 드래그 앤 드롭, 서버 액션 변경 없이 해결하는 접근이 적절합니다.

기존 선례와도 맞습니다. `components/TagInput.tsx`는 모바일에서 태그 삭제 버튼 히트 영역을 키우면서 아이콘 자체는 `h-3 w-3`으로 유지하고, `sm:` 이상에서 기존 작은 크기로 복귀합니다. 카테고리 아이콘 버튼도 같은 방식으로 모바일 hit area만 키우고 데스크톱을 유지하는 결정이 자연스럽습니다.

과한 추상화도 없습니다. 이 컴포넌트는 재사용 표면이 없고, 변경 대상도 `TreeRow`/`IconButton`의 class 계약에 국한됩니다. 접근 방식은 하위 소비자에게 새 인터페이스를 강요하지 않으며, 서버 액션과 category tree 데이터 계약을 그대로 둡니다.

**Implementer Readiness**

계획은 구현자가 무엇을 바꿔야 하는지, 무엇을 건드리면 안 되는지, 왜 그런지 충분히 담고 있습니다. 특히 버튼 hit area, 이름/버튼 충돌, depth 상한, 데스크톱 보존, 서버 액션 비변경, 드래그 앤 드롭 금지를 명확히 적고 있어 capable Developer가 코드 탐색 후 바로 구현할 수 있습니다.

남은 보조 주의점은 inline padding의 responsive 처리뿐입니다. 이건 구현 중 코드를 보면 발견 가능한 수준이고, 계획의 핵심 방향을 바꿀 정도는 아닙니다.

**Scope Fence Compliance**

- Must do는 모두 계획에 반영되어 있습니다. 모바일 버튼 hit area 확대, 이름/버튼 클러스터 겹침 방지, 기존 up/down/edit/delete/add 동작 유지가 Goal, Approach, Design decisions, Acceptance에 반복 명시되어 있습니다.
- Must NOT touch도 준수합니다. 계획은 `app/admin/categories/page.tsx`, `app/actions/categories.ts`, `CategoryForm` 그리드, 드래그 앤 드롭, 데스크톱 표시, 렌더 depth 상한 변경을 명시적으로 제외합니다.
- Sequencing 전제도 타당합니다. `CategoryAdmin.tsx`는 형제 이슈 소유 파일과 겹치지 않고, 원격 `origin/main`과 로컬 사이의 차이도 이 소유 파일에는 없습니다.

**Verdict: PASS**