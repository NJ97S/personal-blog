**Design Premises**

- 거짓 전제 없음. 계획의 핵심 전제는 코드와 일치함.
- `components/SeriesBox.tsx:19-21`은 클라이언트 컴포넌트이고 현재 `useState(true)`로 기본 펼침 상태임.
- `components/SeriesBox.tsx:32-59`는 `open`일 때만 전체 `posts.map(...)` 목록을 렌더링함. 따라서 접힘 상태에서 “앞 5개 미리보기”를 하려면 단순히 `open` 조건을 뒤집는 것이 아니라 `visiblePosts` 같은 파생 목록을 만들어야 함.
- `components/SeriesBox.tsx:61-81`은 하단 바 안에 토글 버튼과 `currentIndex + 1/posts.length` 인디케이터를 함께 렌더링함. 계획의 “토글만 조건부 제거하고 인디케이터는 유지” 전제와 맞음.
- `app/posts/[slug]/page.tsx:139-151`은 같은 `category_id`의 `visibility = public` 글을 `created_at` 오름차순으로 전량 조회한 뒤 `id/slug/title`만 `seriesPosts`로 전달함. 계획의 “서버 쿼리 변경 없이 컴포넌트 내부 slice” 방향은 코드 구조와 맞음.
- `app/posts/[slug]/page.tsx:154-159`의 이전/다음 글 계산도 같은 `seriesPosts` 전체 배열에 의존하므로, `page.tsx`를 건드리지 않는다는 계획은 기존 네비게이션 동작을 보존하는 올바른 경계임.
- `app/posts/[slug]/page.tsx:272-278`은 `seriesPosts.length > 0`일 때만 `SeriesBox`를 렌더링하므로 “글 1개” edge case 전제도 맞음.

**Gaps Discovered**

- Observation: `SeriesBox`의 기존 링크는 `components/SeriesBox.tsx:49`에서 `href={`/posts/${p.slug}`}`로 raw slug를 사용함. `app/posts/[slug]/page.tsx:161` 등 최근 라우팅 수정은 `encodeURIComponent`를 쓰는 방향으로 정리되어 있음. 이 이슈의 접힘/펼침 구현을 깨뜨리는 누락은 아니지만, 같은 파일을 만질 때 slug 인코딩까지 건드릴지 여부는 별도 판단이 필요함. 계획의 현재 범위에는 포함되지 않아 blocking은 아님.
- Observation: 유사 토글인 `components/CategoryTree.tsx:72-77`은 아이콘형 접기 버튼에 `aria-label`을 둠. `SeriesBox`의 기존 버튼은 텍스트가 있어 필수 누락은 아니지만, 상태형 토글로 바꾸는 김에 `aria-expanded`를 추가할 수 있음. 요구사항이나 기존 동작의 필수 조건은 아니므로 blocking은 아님.
- Blocking gap 없음. 계획이 반드시 알아야 할 호출부, 정렬, 전체 배열 전달, 위치 인디케이터, 현재 글 하이라이트 조건을 모두 다루고 있음.

**Design Review**

채택한 방향은 적절함. 이 변경은 데이터 모델이나 서버 조회 문제가 아니라 `SeriesBox`의 표시 정책 변경임. 부모가 이미 전체 공개글 배열을 오름차순으로 넘기고 있고, 이전/다음 네비게이션도 그 전체 배열을 계속 필요로 하므로 서버에서 5개만 자르는 대안은 오히려 기존 구조와 충돌함.

추가 추상화도 필요 없음. `const PREVIEW_COUNT = 5`, `const canToggle = posts.length > PREVIEW_COUNT`, `const visiblePosts = canToggle && !open ? posts.slice(0, PREVIEW_COUNT) : posts` 정도의 컴포넌트 내부 파생값이면 충분함. 이 방식은 현재 prop 인터페이스와 서버/클라이언트 경계를 유지한다.

주의할 점은 기존 JSX가 `{open && <ol>...}` 구조라는 점임. 구현자가 이 조건을 그대로 두고 `open` 기본값만 `false`로 바꾸면 접힘 상태에서 목록이 0개가 되어 요구사항을 실패함. 다만 계획은 “접힘일 때 앞 N개만 렌더링”을 명시하고 있어 전략 오류는 아님.

**Implementer Readiness**

계획은 구현자가 무엇을 바꿔야 하는지 충분히 설명함. 특히 기본값, 5개 임계값, 토글 숨김 조건, 전달받은 순서 유지, 현재 글이 미리보기 밖일 수 있다는 의도, `n/total` 유지까지 코드만 봐서는 헷갈릴 수 있는 정책을 잘 담고 있음.

수용 기준도 브라우저 리플로우 확인까지 포함되어 있어 동적 UI 변경 검증 범위가 명확함. capable Developer가 이 계획과 코드베이스를 읽으면 구현 범위와 금지 범위를 이해하고 진행할 수 있음.

**Scope Fence Compliance**

- Must do 항목은 접근 방식과 acceptance에 모두 반영되어 있음.
- Must NOT touch의 `app/posts/[slug]/page.tsx` 불가침은 코드 구조상 타당함. 해당 파일은 전체 시리즈 배열을 조회하고 이전/다음 네비게이션에도 사용하므로 이 이슈에서 변경하지 않는 편이 맞음.
- “그 외 컴포넌트/서버 액션/DB/스타일 시스템” 금지도 계획의 컴포넌트 내부 slice 방향과 일치함.
- 계획 내부에서 Scope Fence를 위반하는 지시 없음.

**Verdict: PASS**