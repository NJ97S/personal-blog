# Decomposition review — final verdict: PASS (round 7 of 7)

> Filed by lead-epic PM. 7 fresh-eyes rounds total (R1–R4 + R6 = REVISE, R5 + R7 = PASS). Every finding was verified against code and folded into design.md §8. Final PASS below (after adding E-MD-SPACING and the comment-freshness island in E-ISR-POST).

**Coverage Gaps**

없음. 이슈들의 합집합이 High+ 항목을 모두 덮습니다. 확인한 근거:

- ISR/캐시: `app/page.tsx`, `app/categories/[...slug]/page.tsx`, `app/tags/[tag]/page.tsx`, `app/actions/feed.ts`, `lib/categories.ts`, `components/widgets/*`가 모두 cookie-bound `createClient()`를 사용하고 있어 `E-PUBLIC`, `E-WIDGETS`, `#3`, `E-ISR-FEED`, `E-ISR-POST`로 덮입니다.
- 포스트 ISR 전환의 숨은 하위 트리: `app/posts/[slug]/page.tsx`는 `force-dynamic`, `getUser()`, `trackView()`, `Comments` 서버 렌더를 모두 포함합니다. `E-ADMIN-PREVIEW`와 `E-ISR-POST`가 이 범위를 덮습니다.
- 댓글 보안: `supabase/migrations/008_comment_auth.sql`, `009_comment_auth_search_path.sql`에서 RPC가 `anon`에 `GRANT EXECUTE`되어 있고 DB password 최소 길이가 4자입니다. `E-COMMENT-RPC`, `E-COMMENT-TOKEN`이 덮습니다.
- 접근성: `components/PublishModal.tsx`, `components/CategoryDrawer.tsx`는 닫혀도 DOM에 남는 구조입니다. `E-A11Y-INERT`가 덮습니다.
- 테스트/타입: 테스트 설정이 없고 Supabase client generic도 없습니다. `E-EXTRACT`, `E-TESTS`, `#6-types`가 덮습니다.
- 사용자 요청 markdown spacing: `components/MarkdownView.tsx`의 `remarkBreaks`, `app/globals.css`의 `.craft-prose`가 `E-MD-SPACING`으로 덮입니다.

**Dependency Review**

사이클 없음. 주요 의존성은 코드상 타당합니다.

- `E-WIDGETS -> E-PUBLIC`: 위젯들이 새 cookie-less public client를 소비해야 하므로 필요합니다.
- `E-ISR-FEED -> E-WIDGETS/#3/E-EXTRACT/E-PUBLIC`: feed/category/tag는 `<Layout>` 기본 right aside로 `SideWidgets`를 렌더하고, `Header`/`CategorySidebar`가 `fetchCategoryTree()`를 사용하므로 cookie-free subtree가 되려면 선행 작업이 필요합니다.
- `E-ISR-POST -> E-ADMIN-PREVIEW`: 현재 `app/posts/[slug]/page.tsx`가 admin 비공개/초안 preview 역할도 하며, `app/admin/posts/page.tsx` 제목 링크가 `/posts/${post.slug}`로 향합니다. public-only ISR 전환 전에 preview route 분리가 필요합니다.
- `#6-types` late consolidation: schema migration 이슈(`#3`, `E-COMMENT-RPC`, `E-COMMENT-TOKEN`) 이후 타입 생성으로 둔 결정은 migration/type regen 충돌을 피합니다.
- `#5` sink: package/framework major upgrade는 codemod가 repo-wide로 번질 수 있어 마지막 의존성이 맞습니다.

사소한 문구 불일치만 있습니다: `E-WIDGETS` goal에는 `E-ISR-POST`도 공유 foundation이라고 쓰였지만, 실제 graph와 `E-ISR-POST` 설명은 post route가 `rightAside={<PostToc/>}`라 `E-WIDGETS`가 dependency가 아니라고 올바르게 정리합니다. 그래프 결함은 아닙니다.

**Scope Conflicts**

차단할 수준의 conflict 없음. 공유 파일은 dependency로 직렬화되어 있습니다.

- `app/actions/posts.ts`: `E-EXTRACT -> #3`, `#5`는 sink라 충돌 가능성이 낮습니다.
- `app/actions/comments.ts`: `E-EXTRACT -> E-COMMENT-RPC -> E-COMMENT-TOKEN`으로 직렬화되어 있습니다. `E-ISR-POST`는 명시적으로 `app/actions/comments.ts`를 건드리지 않습니다.
- `components/CommentForm.tsx`: `E-COMMENT-TOKEN`과 `#5`가 모두 관련되지만 `#5`가 모든 이슈 이후라 충돌이 정리됩니다.
- `package.json/package-lock.json`: `E-AUDIT -> E-TESTS -> #5`로 직렬화되어 있습니다.
- `components/MarkdownView.tsx`: `E-MD-SPACING`만 소유합니다. `E-ISR-POST`는 post page/data path를 소유하고 이 컴포넌트 자체를 소유하지 않아 충돌이 없습니다.

**Sizing**

대체로 한 PR 규모입니다.

- `E-TESTS`는 가장 큽니다. 다만 설계가 이미 “Playwright harness가 무거우면 split” 조건을 둔 상태라 materialization 전에 막을 결함은 아닙니다.
- `E-ISR-POST`도 큽니다. 하지만 admin preview 분리, comments live island, view tracking 분리를 포함하지 않으면 ISR 전환이 회귀를 만들기 때문에 현재 scope가 필요합니다.
- `E-MD-SPACING`, `E-AUTHEDGE`, `E-AUDIT`, `#2`는 독립 leaf로 적절합니다.
- `#6-types`를 late consolidation으로 둔 것은 작지는 않지만 regen conflict를 줄이는 올바른 절단입니다.

**Codebase Grounding**

분해의 핵심 가정은 현재 코드와 맞습니다.

- `lib/supabase/server.ts`는 `cookies()`를 읽습니다. 이를 쓰는 public route/render subtree는 dynamic화됩니다.
- `lib/categories.ts`는 `React.cache()`만 사용하고 cross-request cache가 없습니다.
- `components/Layout.tsx`는 `rightAside ?? <SideWidgets />`이며, post route만 `rightAside={<PostToc />}`를 넘깁니다.
- `components/Comments.tsx`는 서버에서 comment list를 fetch해 `CommentList` initial state로 넘기므로 post shell ISR에 그대로 넣으면 댓글 freshness 회귀가 생깁니다. `E-ISR-POST`의 client-fetched island 설계가 이 문제를 정확히 겨냥합니다.
- `app/actions/views.ts`는 `headers()`와 cookie-bound Supabase client를 사용합니다. cached render path에서 분리해야 합니다.
- `middleware` redirect branches는 `supabaseResponse`가 아니라 새 `NextResponse.redirect()`를 반환합니다. refreshed cookies drop finding이 맞습니다.
- migration 최고 번호는 `010_popular_posts_rpc.sql`이고, 새 migrations는 next-free 번호가 필요합니다.
- `package-lock.json`이 존재하고, 다른 lockfile은 보이지 않습니다.

**Verdict**

PASS — decomposition은 이슈 생성에 안전합니다. High+ coverage, dependency ordering, shared ownership serialization, codebase grounding 모두 충분합니다. 사소한 `E-WIDGETS` 설명 문구만 정리하면 더 명확하지만, DAG를 수정해야 할 결함은 아닙니다.