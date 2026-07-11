# Summary

`/admin/categories`의 카테고리 트리 행을 모바일에서 터치하기 쉽도록 보정했습니다. 모바일(`md` 미만)에서는 위/아래/편집/삭제 아이콘 버튼의 실제 히트 영역을 44px로 키우고, 이름 영역과 버튼 묶음이 서로 겹치지 않도록 행이 두 줄로 흐르게 했습니다. 데스크톱(`md` 이상)에서는 기존처럼 한 줄 배치와 28px 버튼 크기를 유지합니다.

# Files Changed

- `app/admin/categories/CategoryAdmin.tsx`
  - `TreeRow`의 `<li>`를 모바일에서 wrap 가능한 flex 행으로 바꾸고, `md:` 이상에서는 기존 non-wrap/center 정렬로 복원했습니다.
  - 이름 영역에 모바일 `basis-full`을 주어 버튼 묶음이 아래 줄로 내려갈 공간을 만들었습니다.
  - 긴 이름/slug가 좁은 폭에서 행 밖으로 밀리지 않도록 텍스트에 `break-words`를 추가했습니다.
  - `IconButton`의 모바일 히트 영역을 `h-11 w-11`로 키우고, `md:h-7 md:w-7`로 데스크톱 크기를 유지했습니다.

# Design Decisions

1. 모바일에서 버튼을 44px 히트 영역으로 키우고 아이콘은 그대로 유지했습니다.
   - 선택 이유: 이슈의 핵심 문제는 아이콘 자체가 아니라 터치 가능한 영역이 28px로 작다는 점입니다. `ArrowUp`, `ArrowDown`, `Pencil`, `Trash2` 아이콘의 `h-4 w-4`는 그대로 두고 버튼 박스만 키우면 기존 시각 밀도를 유지하면서 모바일 조작성을 개선할 수 있습니다.
   - 기각한 대안: 아이콘까지 키우는 방식은 데스크톱과 모바일의 시각 차이를 크게 만들고, 기존 craft 스타일의 작은 도구 버튼 인상을 깨뜨릴 수 있어 제외했습니다.

2. 모바일에서는 이름 줄과 버튼 줄을 분리하고, 데스크톱에서는 기존 한 줄 레이아웃을 유지했습니다.
   - 선택 이유: 44px 버튼 4개는 gap 포함 약 188px를 차지하므로 320px 화면, 특히 depth 2의 52px 들여쓰기 조건에서 이름과 같은 줄에 두면 충돌 가능성이 큽니다. 이름 컨테이너에 모바일 `basis-full`을 주면 버튼 묶음이 자연스럽게 다음 줄로 내려가고, `md:basis-auto md:flex-nowrap`가 데스크톱의 기존 한 줄 구성을 복원합니다.
   - 기각한 대안: 버튼을 더보기 메뉴로 접는 방식은 새 상태와 팝오버 UX가 필요하고, 기존 up/down 버튼 방식 유지라는 범위를 넘어섭니다.

3. 트리 들여쓰기는 변경하지 않았습니다.
   - 선택 이유: 현재 렌더되는 최대 depth는 2이고 실제 최대 padding-left는 52px입니다. 모바일에서 줄 분리만으로 320px 하한에서도 버튼 묶음이 들어가는 것을 확인했으므로, depth별 padding 계산을 바꾸지 않는 편이 데스크톱 회귀 위험이 작습니다.
   - 기각한 대안: 모바일 전용 들여쓰기 축소는 가능하지만, 현재 문제 해결에 필수는 아니며 트리 계층감이 약해질 수 있어 제외했습니다.

4. 서버 액션, prop 시그니처, 편집/추가 폼은 건드리지 않았습니다.
   - 선택 이유: 이 이슈는 순수 레이아웃/스타일 보정입니다. `reorderCategory`, `updateCategory`, `deleteCategory`, `createCategory` 호출 경로와 `CategoryForm`의 이미 반응형인 grid는 유지해야 기능 회귀 면적이 작습니다.
   - 기각한 대안: 폼 버튼/그리드까지 함께 정리하는 것은 Must NOT touch에 걸리고, 현재 모바일 트리 행 문제와 직접 관련이 없어 제외했습니다.

# Deviations from Plan

None.

# Tests

자동화 테스트 파일은 추가하지 않았습니다. 이 프로젝트에는 별도 테스트 스크립트가 없고, 변경 범위가 Tailwind class 기반의 반응형 레이아웃에 한정되어 있어 lint/build와 브라우저 레이아웃 측정으로 검증했습니다.

# Verification

- `npm ci`
  - 성공. `package-lock.json` 기준으로 의존성을 설치했습니다.
  - npm audit 결과 8개 취약점(3 moderate, 5 high)이 보고되었지만, 이번 이슈 범위의 기존 의존성 상태이므로 수정하지 않았습니다.
- `npm run lint`
  - 성공: `✔ No ESLint warnings or errors`
- `npm run build`
  - 성공: Next.js 14.2.35 production build 완료.
  - 빌드 중 webpack cache 성능 경고와 edge runtime static generation 경고가 있었지만 빌드는 정상 종료했습니다.
- 브라우저 레이아웃 검증
  - in-app browser용 Node REPL bridge가 이 세션에 노출되지 않아, fallback으로 임시 디렉터리에 Playwright를 설치하고 시스템 Chrome headless를 사용했습니다.
  - `/admin/categories`는 Supabase middleware로 보호되어 이 독립 worktree에서 실제 관리자 세션을 만들 수 없었습니다. 대신 `next build`가 생성한 `.next/static/css/*.css`를 그대로 로드한 브라우저 fixture에 실제 `TreeRow` 마크업과 class 조합을 렌더해 측정했습니다.
  - viewport 320px, 430px: 버튼 4개의 크기가 모두 44x44px이고 이름 영역과 버튼 묶음이 겹치지 않음을 확인했습니다.
  - viewport 768px: 버튼 4개의 크기가 모두 28x28px이고 이름 영역과 버튼 묶음이 한 줄에서 겹치지 않음을 확인했습니다.
- `git diff --check`
  - 성공. whitespace 오류 없음.

# Escalations

None.
