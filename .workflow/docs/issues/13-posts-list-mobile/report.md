# Summary

`/admin/posts` 글 목록 페이지의 모바일 가로 넘침을 페이지 내부 Tailwind 클래스 조정만으로 보정했습니다. 헤더는 `md` 미만에서 제목과 버튼 클러스터가 세로로 흐르고 버튼은 줄바꿈 가능하게 했으며, `md` 이상에서는 기존처럼 가로 `space-between` 배치를 유지합니다.

글 목록 행은 긴 제목이 실제로 줄어들 수 있도록 제목 영역의 flex 축소 계약을 보강했습니다. 상태 배지와 `편집` 링크는 `shrink-0`으로 고정해 긴 제목이 있어도 보존되며, 제목과 slug는 가로로 행을 밀지 않고 truncate됩니다.

# Files Changed

- `app/admin/posts/page.tsx`
  - 헤더 컨테이너를 모바일 `flex-col`, 데스크톱 `md:flex-row md:items-center md:justify-between` 구조로 변경했습니다.
  - 헤더 버튼 클러스터와 상태 필터 nav에 `flex-wrap`을 추가해 320px급 폭에서도 겹치거나 화면 밖으로 나가지 않게 했습니다.
  - 목록 행의 본문 컨테이너에 `flex-1`, 안쪽 제목 줄과 제목 링크에 `min-w-0`, 배지와 편집 링크에 `shrink-0`을 추가했습니다.

- `.workflow/docs/issues/13-posts-list-mobile/report.md`
  - 구현 내용, 설계 판단, 검증 결과, 환경상 제한을 기록했습니다.

# Design Decisions

1. 헤더는 새 컴포넌트를 만들지 않고 기존 서버 컴포넌트의 클래스만 바꿨습니다.

   대안은 모바일 전용 헤더 컴포넌트나 드로어를 추가하는 것이었습니다. 하지만 이 이슈의 문제는 버튼 세 개가 한 줄에 고정되어 폰 폭에서 넘치는 레이아웃 문제이고, 계획의 Scope Fence도 다른 admin UX 신설을 금지합니다. 그래서 `flex-col`을 기본값으로 두고 `md:` 이상에서 기존 가로 배치를 복원했습니다.

2. 버튼 클러스터는 모바일에서 폭 전체를 차지하도록 강제하지 않고 `flex-wrap`만 허용했습니다.

   대안은 버튼을 전부 `w-full`로 만들어 세로 버튼 목록처럼 보이게 하는 것이었습니다. 이 방식은 320px에서는 안전하지만 390-430px에서 기존 크래프트 카드 버튼의 밀도를 불필요하게 낮춥니다. `flex-wrap`은 필요한 경우에만 다음 줄로 흐르므로 좁은 화면 안전성과 기존 시각 밀도 사이의 균형이 좋습니다.

3. 상태 필터 nav도 구조를 유지하고 `flex-wrap`만 추가했습니다.

   대안은 nav를 스크롤 탭이나 select로 바꾸는 것이었습니다. 하지만 필터 동작은 `?status=` 링크 네 개로 이미 충분하고 Acceptance는 동작 유지를 요구합니다. 텍스트가 짧아 대부분 한 줄에 들어가지만, 폰 하한과 글꼴 렌더링 차이를 고려해 줄바꿈만 허용했습니다.

4. 긴 제목 처리는 행 구조 재설계가 아니라 flex item의 최소 폭 계약 보정으로 해결했습니다.

   대안은 모바일에서 제목, 배지, 편집 링크를 세로 스택으로 재배치하는 것이었습니다. 현재 문제의 원인은 `truncate` 자체가 아니라 flex item의 기본 `min-width: auto` 때문에 제목 링크가 내용 폭 아래로 줄지 못하는 점입니다. 따라서 본문 영역은 `flex-1 min-w-0`, 제목 줄은 `min-w-0`, 제목 링크는 `min-w-0 truncate`로 두고, 보존되어야 하는 배지와 편집 링크만 `shrink-0`으로 고정했습니다. 이 방식은 데스크톱 행 모양을 유지하면서 원인만 제거합니다.

5. 서버 액션, Supabase 조회, 인증 흐름은 건드리지 않았습니다.

   대안은 테스트 편의를 위해 `/admin/posts` 접근 흐름이나 데이터를 우회하는 코드를 넣는 것이었습니다. 이는 계획의 Must NOT touch에 걸리고 실제 제품 동작을 바꾸므로 배제했습니다. 실브라우저 검증은 인증된 실제 페이지 대신, production CSS bundle과 동일한 변경 마크업을 사용하는 임시 fixture로 레이아웃 계약을 측정했습니다.

# Deviations from Plan

실제 `/admin/posts` production 페이지를 로그인 후 브라우저에서 직접 확인하지 못했습니다. 이 워크트리에는 `.env*`가 없고 현재 shell에도 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없어, `next start` 상태에서 `/admin/posts` 요청이 Supabase client 생성 단계에서 500으로 실패했습니다.

대신 `next build`가 생성한 production CSS bundle과 `app/admin/posts/page.tsx`의 변경된 마크업을 그대로 반영한 임시 HTML fixture를 Chrome/Playwright로 열어 320, 390, 430, 1024px에서 overflow와 truncate 동작을 측정했습니다. 인증/데이터 로딩 검증은 아니지만, 이 이슈가 수정한 레이아웃 계약은 실제 브라우저 엔진에서 확인했습니다.

# Tests

자동 테스트 파일은 추가하지 않았습니다. 이 프로젝트에는 별도 test script가 없고, 변경 범위가 서버 동작이 아닌 Tailwind className 보정에 한정되어 있습니다.

수행한 검증:

- `npm run lint`
- `npm run build`
- production CSS bundle + 변경 마크업 fixture를 Chrome/Playwright로 측정

브라우저 fixture 결과:

- 320px, 390px, 430px, 1024px 모두 `documentOverflow`, `headerOverflow`, `actionsOverflow`, `rowOverflow`가 `0`
- 모든 폭에서 긴 제목은 `titleScrollWidth > titleClientWidth`이며 `overflow: hidden`, `text-overflow: ellipsis` 상태
- 상태 배지와 `편집` 링크의 폭은 유지됨
- 헤더 방향은 320/390/430px에서 `column`, 1024px에서 `row`

# Verification

`npm ci`

- lockfile 기준으로 dependencies 설치 완료
- npm audit은 기존 dependency 취약점 8개를 보고했지만, 이 작업 범위와 무관해 수정하지 않았습니다.

`npm run lint`

- 통과
- 출력 요약: `✔ No ESLint warnings or errors`

`npm run build`

- 통과
- 출력 요약:
  - `✓ Compiled successfully`
  - `✓ Generating static pages (16/16)`
  - `/admin/posts` route가 production build에 포함됨

`next start --port 3100` 후 `/admin/posts`

- 직접 접근은 500으로 실패했습니다.
- 원인: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 부재로 middleware의 Supabase client 생성이 실패했습니다.

Chrome/Playwright fixture 측정 요약:

```json
[
  { "viewport": 320, "documentOverflow": 0, "headerOverflow": 0, "actionsOverflow": 0, "rowOverflow": 0, "titleTruncates": true, "headerDirection": "column" },
  { "viewport": 390, "documentOverflow": 0, "headerOverflow": 0, "actionsOverflow": 0, "rowOverflow": 0, "titleTruncates": true, "headerDirection": "column" },
  { "viewport": 430, "documentOverflow": 0, "headerOverflow": 0, "actionsOverflow": 0, "rowOverflow": 0, "titleTruncates": true, "headerDirection": "column" },
  { "viewport": 1024, "documentOverflow": 0, "headerOverflow": 0, "actionsOverflow": 0, "rowOverflow": 0, "titleTruncates": true, "headerDirection": "row" }
]
```

# Escalations

실제 인증된 `/admin/posts` 페이지의 production browser 검증은 환경 변수와 admin 세션이 필요합니다. 현재 워크트리에는 Supabase 환경 변수가 없어 직접 페이지 접근이 500으로 막혔습니다. PM 또는 다음 검증자는 Supabase 환경 변수와 admin 로그인 세션이 있는 환경에서 최종 시각 확인을 수행해야 합니다.
