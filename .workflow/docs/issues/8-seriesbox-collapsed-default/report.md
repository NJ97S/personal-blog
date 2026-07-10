# Summary

`SeriesBox`의 기본 표시 상태를 펼침에서 접힘으로 변경했다. 카테고리 글이 6개 이상이면 최초 렌더링 시 전달받은 순서의 앞 5개만 보여주고 `펼치기` 버튼을 표시하며, 버튼 클릭 후에는 전체 목록과 `숨기기` 버튼을 표시하도록 했다. 글이 5개 이하이면 전체 목록을 그대로 렌더링하고 토글 버튼은 숨기되, 하단 `n/total` 위치 인디케이터는 계속 유지한다.

# Files Changed

- `components/SeriesBox.tsx`
  - `PREVIEW_POST_COUNT` 상수를 추가해 미리보기 개수와 토글 표시 임계값을 같은 값으로 관리했다.
  - `open` 초기값을 `false`로 바꿔 기본 접힘 상태가 되도록 했다.
  - `canToggle`, `visiblePosts`를 계산해 접힘 상태에서는 앞 5개만, 펼침 상태나 전체 5개 이하에서는 전체 목록을 렌더링하도록 했다.
  - 토글 버튼을 `posts.length > 5`일 때만 렌더링하도록 변경했다.
  - 위치 인디케이터에는 `ml-auto`를 붙여 토글 버튼이 없는 경우에도 푸터 오른쪽에 남도록 했다.

# Design Decisions

1. 미리보기 개수는 컴포넌트 내부 상수 `PREVIEW_POST_COUNT = 5`로 두었다. 대안은 `5`를 렌더링 분기마다 직접 쓰는 방식이었지만, 접힘 노출 개수와 토글 숨김 기준이 같은 정책이므로 상수 하나로 묶는 편이 이후 리뷰에서 의도를 확인하기 쉽다.

2. `visiblePosts`를 렌더링 직전에 계산하고 기존 `posts` prop은 변형하지 않았다. 대안은 부모에서 잘라 전달하거나 `posts`를 재정렬하는 방식이었지만, 계획의 스코프 펜스가 `app/posts/[slug]/page.tsx` 변경을 금지하고 있고 요구사항도 "전달받은 순서의 앞 5개"를 기준으로 한다.

3. 접힘 상태에서도 `<ol>` 자체는 항상 렌더링하고, 그 안의 항목만 `visiblePosts`로 제한했다. 대안은 기존처럼 `open`이 `false`일 때 목록 전체를 숨기는 방식이었지만, 이번 요구사항의 접힘은 "목록 없음"이 아니라 "앞 5개 미리보기"라서 목록 컨테이너를 유지하는 쪽이 의미에 맞다.

4. 토글 버튼 조건과 위치 인디케이터 조건을 분리했다. 대안은 푸터 전체를 토글 가능 여부에 맞춰 숨기는 방식이었지만, 계획에서 `n/total` 위치 인디케이터는 모든 경우 유지해야 한다고 명시했으므로 버튼만 조건부 렌더링했다.

# Deviations from Plan

None

# Tests

새 테스트 파일은 추가하지 않았다. 이 프로젝트에는 현재 테스트 러너나 `npm test` 스크립트가 없고, 이번 변경은 단일 클라이언트 컴포넌트의 렌더링 분기 변경에 한정되어 기존 검증 경로인 `npm run lint`와 `npm run build`로 타입/린트/프로덕션 컴파일을 확인했다.

# Verification

- 최초 `npm run lint`: 실패. `node_modules`가 없어 `next: command not found`가 발생했다.
- 최초 `npm run build`: 실패. `node_modules`가 없어 `next: command not found`가 발생했다.
- `npm ci`: 성공. 기존 `package-lock.json` 기준으로 의존성을 설치했다. npm audit은 8개 취약점(3 moderate, 5 high)을 보고했지만 이번 이슈 범위 밖이라 수정하지 않았다.
- 재실행 `npm run lint`: 성공. `✔ No ESLint warnings or errors`
- 재실행 `npm run build`: 성공. Next.js 14.2.35 프로덕션 빌드, 타입 검사, 정적 페이지 생성이 모두 완료되었다. 빌드 중 `edge runtime` 사용 시 정적 생성 비활성화 경고와 webpack 캐시 성능 경고가 있었지만 실패는 없었다.
- `npm run`: 확인 결과 프로젝트 스크립트는 `dev`, `build`, `start`, `lint`뿐이며 별도 테스트 스크립트는 없다.
- `git diff --check`: 성공. 공백 오류 없음.
- `.workflow/bin/render-doc.sh .workflow/docs/issues/8-seriesbox-collapsed-default/`: 실패. 이 worktree에는 `.workflow/bin/render-doc.sh`가 없고, `.workflow` 아래에는 현재 `plan.md`와 `report.md`만 존재한다.

브라우저 동적 검증은 완료하지 못했다. 실제 `/posts/[slug]` 페이지는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 환경 변수가 필요한데 현재 worktree 환경에서는 둘 다 설정되어 있지 않았다. 또한 이 세션에서 브라우저 자동화용 Node REPL 도구를 검색했지만 노출되지 않아 인앱 브라우저를 사용할 수 없었다. 스코프 펜스 밖의 fixture route나 서버 데이터 흐름 변경으로 우회하지 않았다.

# Escalations

1. 실제 브라우저에서 `SeriesBox` 접힘/펼침 리플로우까지 확인하려면 PM 또는 리뷰어가 Supabase 환경 변수가 설정된 로컬/스테이징 환경에서 확인해야 한다.
2. 보고서 렌더링까지 요구된다면 PM 또는 오케스트레이터가 `.workflow/bin/render-doc.sh`를 제공한 뒤 다시 실행해야 한다.
