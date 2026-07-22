# 에픽: 코드베이스 하드닝 (2026-07 전체 코드리뷰)

> 작성: lead-epic PM · 날짜: 2026-07-11 (fresh-eyes 리뷰 후 개정) · 기준: `main` @ `8166cc4`
> 스택: Next.js 14.2.35 (App Router) · React 18.3 · Supabase SSR · Upstash Ratelimit · TypeScript 5 (strict)
> 범위: ~77개 TS/TSX 파일, ~6.5k LOC (`app/**`, `components/**`, `lib/**`, `middleware.ts`, 설정, `supabase/migrations/**`)

## 1. 에픽 목표 (crystallized requirement)

현재 `main` HEAD 기준으로 전체 코드베이스를 **정확성·보안·성능·유지보수성/접근성/테스트** 4개 축으로 새로 리뷰하고, **High 이상** 발견사항을 상호 배타적이고 각각 한 PR 규모인 GitHub 이슈 DAG로 정리해 실행 가능한 상태로 만든다. 기존 열린 이슈 **#2~#7을 이 에픽의 마일스톤 아래로 흡수**(재사용 또는 재작성)하며, Medium 이하는 문서에 백로그로만 기록한다.

이 에픽 자체는 수정 코드를 작성하지 않는다. 마일스톤 + 이슈 DAG를 산출하며, 각 노드는 이후 `/lead-issue`로 구동한다.

## 2. 리뷰 수행 방식

5개의 독립 도메인 리뷰어(Opus `code-reviewer` ×4 + `security-reviewer` ×1)를 `8166cc4`에 대해 병렬로 실행했다. 각 리뷰어에게 이전 **2026-06-01** 리뷰(`docs/code-review/2026-06-01/`)와 열린 이슈 #2~#7을 제공하고, 모든 주장을 *현재* 코드에 대해 재검증하여 `NEW` / `STILL-PRESENT` / `COVERED-BY #N` / `FIXED-SINCE`로 태깅하도록 요구했다. 이후 아래 분해는 **7라운드의 fresh-eyes 리뷰**(`review-decomposition`)를 거쳤고, 그 발견사항을 모두 반영했다(§8 참조).

**핵심: 코드베이스는 2026-06-01 이후 상당히 하드닝됐다.** 이전 Critical/High는 거의 다 현재 코드에서 수정·검증됐다: JsonLd `</script>` XSS, 검색 `LIKE` injection, `remotePatterns:'**'` SSRF, CSP/HSTS 부재, RSS `]]>` 파손, `publishPost` UUID 검증, cron `timingSafeEqual`, `escapeHtml` 완전 이스케이프, 미들웨어 `is_admin` 게이트, rehype-highlight 언어 서브셋, `trackView` fire-and-forget — 모두 수정됨. 아래 발견사항은 **잔존 + 신규 발견** High+ 항목이다.

## 3. High+ 발견사항 종합 (5개 리뷰어 결과 dedupe)

| ID | 발견사항 | 심각도 | 상태 | 이슈 |
|----|---------|-----|--------|-------|
| PERF-C-1 | 커스텀 폰트 `memoment-kkukkukk.woff2` 2.36MB `preload:true` → 모든 라우트에서 지배적 LCP 비용 | Critical | COVERED #2 | **#2** |
| AR-H-1 | 피드 페이지(`/`, `/categories`, `/tags`)가 `revalidate`를 선언하지만 `createClient()`로 `cookies()`를 읽음 → 매 요청 동적 렌더; `revalidate`가 죽은 no-op (실측 `page.tsx:14`→`server.ts:5`) | High | NEW | **E-ISR-FEED** |
| PERF-H-1 | `app/posts/[slug]/page.tsx:18` `force-dynamic` → 최다 트래픽·최고 캐시성 라우트가 절대 캐시 안 됨 | High | STILL | **E-ISR-POST** |
| PERF-H-3 | 글 라우트의 직렬 쿼리 워터폴(`getUser`→`post`→`series`)을 매 조회마다 지불 | High | STILL | **E-ISR-POST** |
| PERF-H-2 | `/tags/[tag]` 쿼리에 `.limit()` 없음 → 태그가 커질수록 응답/메모리 무한 증가 | High | STILL | **E-ISR-FEED** |
| PERF-H-4 | `fetchCategoryTree`가 `react cache()`만 사용(렌더 단위), cross-request 캐시 없음 | High | COVERED #3 | **#3** |
| AR-H-2 | 미들웨어 redirect 분기가 새 `NextResponse.redirect`를 반환하면서 갱신된 Supabase 인증 쿠키를 버림 → 토큰 로테이션 유실 / 부당 로그아웃 | High | NEW | **E-AUTHEDGE** |
| CMP-H-1 | 닫힌 `PublishModal`이 마운트된 채(opacity로만 숨김); `type=submit` 버튼이 키보드 tabbable → 키보드 사용자가 모달을 열지 않고 발행 가능 | High | NEW | **E-A11Y-INERT** |
| CMP-H-2 | `CategoryDrawer` 오프스크린 콘텐츠가 닫힘 시 tabbable | High | COVERED #7 (REV-M-3) | **E-A11Y-INERT** |
| SEC-H-1 | 댓글 mutation RPC가 `GRANT EXECUTE TO anon`; 앱 레이어 Upstash 레이트리밋을 공개 anon key로 `/rest/v1/rpc/*` 직접 호출해 우회 가능. 비밀번호 최소 4자 → 오프라인 속도 브루트포스로 임의 게스트 댓글 편집/삭제; insert 스팸 무제한 | High | NEW | **E-COMMENT-RPC** |
| SEC-H-2 | `npm audit`: `next@14.2.35`가 캐시 포이즈닝(미들웨어 인증과 연관), SSRF, DoS 권고 범위 내; `ws` high(메모리 노출 + DoS) | High | NEW | **E-AUDIT** (`ws`) + **#5** (Next) |
| MNT-H-1 | 보안상 중요한 순수 로직 주변에 자동화 테스트 전무; 한 글자 수정으로 조용히 취약점 재개방 가능 | High | COVERED #6 | **E-EXTRACT** + **E-TESTS** |
| MNT-H-2 | Supabase 클라이언트가 `Database` 제네릭 없이 생성 → 데이터 레이어 무타입; 스키마 드리프트에도 `tsc` 통과 | High | COVERED #6 | **#6-types** |
| UX-1 | 렌더된 글 마크다운의 줄 간격이 어색: `remarkBreaks`가 모든 단일 개행을 하드 `<br>`로(`MarkdownView.tsx:123`) + 튜닝 안 된 `prose` 간격 | — (사용자 요청) | NEW | **E-MD-SPACING** |

Medium/Low 백로그: §6.

## 4. 접근 / 아키텍처

발견사항은 6개 테마로 묶인다. DAG 형태를 결정하는 두 아키텍처 축이 있다.

**축 A — 캐싱/렌더링.** AR-H-1, PERF-H-1/H-3, PERF-H-4는 모두 하나의 근본 원인에서 나온다: **공개 데이터 읽기가 쿠키 바인딩 `createClient()`를 경유**하며, 이는 `cookies()`를 읽어 동적 렌더를 강제하고 ISR을 무력화한다. 실측 확인: `app/page.tsx:14`→`lib/supabase/server.ts:5`. 이를 가능케 하는 수정은 **쿠키리스 public 읽기 클라이언트**이고, 라우트 레벨 ISR은 그 위에 쌓인다. 결정적으로, 라우트는 *전체* 렌더 서브트리가 cookie-free일 때만 정적이 된다 — 그래서 `E-ISR-POST`는 페이지 자체 쿼리뿐 아니라 `components/Comments.tsx`(`createClient()` 호출)와 `trackView` 호출(`headers()` 사용)도 함께 고쳐야 한다.

```
E-PUBLIC (쿠키리스) ─┬─► E-WIDGETS ──► E-ISR-FEED  (피드/카테고리/태그는 기본 SideWidgets 사용)
                     └─► #3 ─────────┬─► E-ISR-FEED
                         (캐시+RPC)   └─► E-ISR-POST  ◄── E-ADMIN-PREVIEW
E-EXTRACT (순수 유틸) ─► E-TESTS ; ─► #3 / E-ISR-FEED / E-COMMENT-RPC (공유 파일)
스키마 이슈 (#3, E-COMMENT-*) + E-WIDGETS ─► #6-types (타입은 마지막) ─► #5 (sink)
```
(라우트가 ISR이 되려면 **전체** 서브트리가 cookie-free여야 한다. 피드/카테고리/태그는 기본 `<SideWidgets/>`를 렌더 → `E-WIDGETS`가 게이팅; 글 라우트는 `rightAside={<PostToc/>}`를 넘기므로 렌더 **안 함** → `E-WIDGETS`는 피드 이슈들만 게이팅. 글 라우트는 추가로 `E-ADMIN-PREVIEW`가 먼저 필요해, admin auth 게이트를 제거해도 비공개/초안 미리보기가 사라지지 않게 한다.)

**축 B — 타이핑 vs 마이그레이션 (역전으로 해결).** `#6-types`는 라이브 스키마에 대해 `supabase gen types`를 실행한다. 이를 스키마 변경 이슈(`#3`, `E-COMMENT-*`) *앞에* 두면, 각 이슈가 `database.types.ts`를 재생성해야 해서 병렬 재생성 및 마이그레이션 번호 충돌이 발생한다(두 리뷰 라운드에서 지적됨). **해결: `#6-types`를 *늦은* consolidation 패스로 둔다** — 모든 스키마 이슈에 의존하고, 최종 스키마에서 타입을 한 번만 생성한 뒤 모든 클라이언트 팩토리에 `<Database>` 제네릭을 추가하고 `as unknown as` 캐스트를 제거한다. 결과: `#6-types`가 착지하기 전까지 데이터 레이어는 무타입 상태로 남는데, 이는 정확히 현재 상태이므로 회귀가 아니며, 재생성/번호 충돌이 완전히 사라진다.

두 축과 독립적: **auth-edge 정확성**(`E-AUTHEDGE`), **접근성**(`E-A11Y-INERT`), **폰트**(`#2`), **의존성 감사**(`E-AUDIT`).

### 횡단 조율 노트 (`lead-issue` 플래너용)

1. **`database.types.ts`는 마지막에 한 번만 생성.** 오직 `#6-types`만 모든 마이그레이션 착지 후 생성/편집한다. 다른 이슈는 건드리지 않음 → 동시 재생성 충돌 없음.
2. **마이그레이션 번호 — 구현 시점에 조율.** 현재 최고 마이그레이션은 `010_popular_posts_rpc.sql`. `#3`, `E-COMMENT-RPC`, `E-COMMENT-TOKEN`이 각각 하나씩 추가; 구현 시점에 플래너가 `main`의 다음 가용 번호를 취한다. `E-COMMENT-TOKEN`은 `E-COMMENT-RPC`에 의존하고 `#3`이 먼저 실행되므로 번호는 자연히 정렬됨; 하드코딩 금지.
3. **`package.json`은 공유 핫스팟**, 직렬화: `E-AUDIT`(dep/override + lockfile) → `E-TESTS`(테스트 `devDependencies` + `test` 스크립트) → `#5`(react/next 메이저). lockfile은 `package-lock.json`(npm — 저장소 루트에 확인됨; pnpm/yarn/bun lockfile 없음).
4. **순수 유틸 추출이 소비자보다 선행.** `E-EXTRACT`가 테스트 가능한 로직을 `lib/`로 옮기고 `search/page.tsx`, `actions/{posts,categories,comments,feed}.ts`의 호출부를 재지정; 같은 파일을 편집하는 이슈들(`#3`, `E-ISR-FEED`, `E-COMMENT-RPC`)은 `E-EXTRACT`에 의존해 추출이 먼저 착지하게 한다.
5. **검증.** ISR 주장(AR-H-1, PERF-H-1)은 `next build` 라우트 테이블(`○`/ISR vs `ƒ`/dynamic)로 확인 — `next dev` 아님(CSP/eval 주의, 프로젝트 메모리). a11y 주장은 실제 Chrome에서 검증(`feedback_verify_ui_in_browser`).

## 5. DAG 분해 (이슈들)

범례: **new** · **reuse** · **rescope**(기존 편집) · **supersede**(닫고 다른 곳에 흡수). 17개 이슈.

### #2 — perf(fonts): kkukkukk WOFF2 서브셋 (reuse)
- **목표:** 2.36MB 폰트를 ~200–400KB로 서브셋하고 `next/font` preload를 재튜닝해 모든 라우트의 LCP를 줄임.
- **소유:** `app/fonts/**`, `app/layout.tsx`(폰트 설정만).
- **건드리지 말 것:** 라우트 로직, Supabase 클라이언트.
- **의존:** —
- **수용조건:** 서브셋 woff2 커밋; Lighthouse LCP before/after 기록; 사용되는 모든 한글 글리프 렌더; 미참조 5.4MB `.ttf` 제거.

### E-AUDIT — security(deps): non-breaking `ws` 감사 수정 (new)
- **목표:** SEC-H-2의 *non-breaking* 절반을 즉시 해소 — `ws`(high: 메모리 노출 + DoS)를 `npm audit fix`/override로 패치, 프레임워크 메이저와 분리. (`postcss`와 `next@14` 권고는 Next 전이 의존이라 `#5`에서 처리, 여기서 아님.)
- **소유:** `package.json`(dependency/override 항목만), `package-lock.json`.
- **건드리지 말 것:** react/next 버전(`#5`), 테스트 devDeps(`E-TESTS`), 모든 소스 파일.
- **의존:** — (빠르고, 이르고, 독립적)
- **수용조건:** `npm audit`가 `ws` high 권고를 더 이상 보고 안 함; 앱 빌드 정상; 런타임 dep 메이저 변경 없음.

### E-EXTRACT — refactor(lib): 테스트 가능한 순수 유틸 추출 (new)
- **목표:** 보안상 중요한 순수 로직을 route/action 파일에서 `lib/` 모듈로 **동작 변경 없이** 옮겨 단위 테스트와 중복 제거가 가능하게: `sanitize`+`escapeLike`(search) → `lib/search-sanitize.ts`; `stripUnsafe`(comments) → `lib/comment-sanitize.ts`; `UUID_RE` + `validate`/`parseVisibility`/`parseFormData`(posts) + `validate`(categories) + `UUID_RE`/`isValidCursor`(feed) → `lib/validation.ts`. 모든 호출부 재지정; export는 순수 함수. (MNT-H-1 선행 해제; `UUID_RE` 중복 백로그 흡수.)
- **소유:** 신규 `lib/validation.ts`, `lib/search-sanitize.ts`, `lib/comment-sanitize.ts`; `app/search/page.tsx`, `app/actions/posts.ts`, `app/actions/categories.ts`, `app/actions/comments.ts`, `app/actions/feed.ts` 편집(import만 — 로컬 중복 제거).
- **건드리지 말 것:** 렌더링 모드, Supabase 클라이언트 팩토리, DB 마이그레이션, 추출 함수의 동작.
- **의존:** —
- **수용조건:** `tsc` clean; 동작 동일(같은 입력→같은 출력); 추출 함수는 export된 순수 함수; `UUID_RE` 중복 없음.

### E-PUBLIC — feat(supabase): 쿠키리스 public 읽기 클라이언트 (new)
- **목표:** 공개·비개인화 읽기용 `createPublicClient()`(anon key, **`cookies()` 미사용**)를 추가해 공개 라우트가 더 이상 동적 렌더로 강제되지 않게 함. ISR의 토대. **이 단계에서는 무타입** — 이후 `#6-types`가 다른 팩토리와 함께 `<Database>`를 적용.
- **소유:** 신규 `lib/supabase/public.ts`.
- **건드리지 말 것:** `server.ts`/`client.ts`/`admin.ts`; route 파일 없음; `lib/categories.ts` 없음.
- **의존:** —
- **수용조건:** `createPublicClient()`가 `cookies()`를 절대 호출하지 않는 클라이언트 반환; "public reads only — never auth/admin/mutations" 문서화.

### E-WIDGETS — refactor(widgets): 기본 사이드바 위젯을 public 클라이언트로 (new)
- **목표:** `components/Layout.tsx`가 기본으로 `<SideWidgets />`를 렌더하고(`rightAside ?? <SideWidgets />`), `PopularPosts`/`RecentPosts`/`RecentComments`가 모두 쿠키 바인딩 `createClient()`를 호출한다(실측). 이 때문에 `Layout`을 쓰는 **모든** 페이지의 렌더 서브트리에 `cookies()`가 남아, 페이지 본문을 바꿔도 ISR이 동작하지 않는다. 이 공개·비개인화 위젯 읽기를 `createPublicClient()`로 전환. `E-ISR-FEED`가 공유하는 토대.
- **소유:** `components/SideWidgets.tsx`, `components/widgets/PopularPosts.tsx`, `components/widgets/RecentPosts.tsx`, `components/widgets/RecentComments.tsx`(클라이언트 교체만 — `as unknown as` 캐스트는 `#6-types`가 처리하므로 유지).
- **건드리지 말 것:** 페이지 파일, `lib/categories.ts`, 위젯 마크업/동작.
- **의존:** `E-PUBLIC`.
- **수용조건:** `SideWidgets` 하위 어떤 위젯도 `cookies()`를 호출하지 않음; 위젯 출력 불변.

### #3 — fix(categories): 트랜잭션 reorder RPC + cross-request 캐싱 (reuse, 범위 추가)
- **목표:** (a) `reorderCategory` → 단일 Supabase RPC/트랜잭션; (b) `fetchCategoryTree`를 `unstable_cache`(tag `categories`, `createPublicClient` 경유)로 감싸고 **카테고리 글 수를 바꾸는 모든 mutation**에서 `revalidateTag('categories')` — 카테고리 mutation(`app/actions/categories.ts`) **및 글 mutation**(`createPost`/`updatePost`/`deletePost`/`publishPost`/`unpublishPost` in `app/actions/posts.ts`). `category_post_counts`가 `visibility='public'` 글을 집계하기 때문(실측 `005_post_visibility.sql`). (PERF-H-4)
- **소유:** `lib/categories.ts`, `app/actions/categories.ts`, `app/actions/posts.ts`(글 mutation에 `revalidateTag('categories')` 추가 — 다른 로직 변경 없음), 신규 `supabase/migrations/<다음 가용 번호>_reorder_category.sql`.
- **건드리지 말 것:** route 페이지, `lib/supabase/public.ts`(소비만), `database.types.ts`(재생성은 `#6-types`), 글 *로더/렌더* 로직(그건 `E-ISR-POST`).
- **의존:** `E-PUBLIC`, `E-EXTRACT`(`categories.ts`/`posts.ts` 공유).
- **수용조건:** 동시 reorder가 중복 `sort_order`를 남기지 않음; 카테고리 트리 cross-request 서빙; 카테고리 create/update/delete/reorder **및** 글 create/delete/publish/unpublish/카테고리이동 시 카운트 무효화(검증: 글 발행 시 전체 배포 없이 카테고리 카운트 갱신).

### E-ISR-FEED — perf(routes): 피드 페이지 ISR 활성화 + 태그 쿼리 바운딩 (new)
- **목표:** `/`, `/categories/[...slug]`, `/tags/[tag]`와 **`loadMorePosts` 서버 액션**을 `createPublicClient`로 전환해 `revalidate`가 실제 동작하게 하고(AR-H-1) 무한스크롤 경계도 cookie-free로 유지; 태그 페이지에 `.limit(FEED_PAGE_SIZE+1)`을 추가해 바운딩(PERF-H-2).
- **소유:** `app/page.tsx`, `app/categories/[...slug]/page.tsx`, `app/tags/[tag]/page.tsx`, `app/actions/feed.ts`.
- **건드리지 말 것:** `app/posts/[slug]/page.tsx`(`E-ISR-POST`), `lib/categories.ts`, `app/actions/categories.ts`, `components/InfinitePostList.tsx`/`lib/feed.ts` **계약**(범위 노트 참조).
- **범위 노트:** 태그의 High 수정은 `.limit()`로 *쿼리 바운딩*이다. 태그 **무한스크롤**은 `InfinitePostList`/`loadMorePosts` 계약 확장(현재 태그필터 없음 — 실측)이 필요해 §6 백로그로 이연, 이 이슈를 한 PR로 유지.
- **의존:** `E-PUBLIC`, `E-WIDGETS`(안 하면 `SideWidgets`가 서브트리에 `cookies()` 유지), `#3`, `E-EXTRACT`.
- **수용조건:** `next build`에서 해당 라우트가 ISR(=`ƒ` 아님); 렌더 서브트리 어디에도 `cookies()` 없음(본문, `feed.ts` public 읽기, **기본 `SideWidgets`**); 태그 페이지 행수 캡; 오해 소지 `revalidate` 주석 정정.

### E-ADMIN-PREVIEW — feat(admin): 비공개/초안 글 전용 미리보기 라우트 (new)
- **목표:** 현재 `/posts/[slug]`가 관리자 미리보기를 겸한다: `getUser()`+`is_admin`을 읽어 관리자에게 비공개 글을 보여주고(실측 `page.tsx:27-43,247`), 관리자 목록이 그리로 링크한다(`app/admin/posts/page.tsx:94`). `E-ISR-POST`가 이 라우트를 공개 전용 ISR로 만들기 **전에**, 관리자 미리보기를 **전용** cookie-bound·admin-gated 라우트(예: `/admin/posts/[id]/preview`)로 옮기고 목록 링크를 재지정. 공개 라우트가 auth를 그만둬도 "발행 전 미리보기" 동작을 보존.
- **소유:** 신규 `app/admin/posts/[id]/preview/` 라우트, `app/admin/posts/page.tsx`(링크 대상만 변경).
- **건드리지 말 것:** `app/posts/[slug]/page.tsx`(그건 `E-ISR-POST`), Supabase 팩토리.
- **의존:** —
- **수용조건:** 관리자가 새 라우트로 비공개/초안 글 미리보기 가능(dynamic, auth-gated); 관리자 목록이 그리로 링크; 실제 Chrome 검증.

### E-ISR-POST — perf(post): 공개 글 라우트 ISR (Comments + 조회수 트래킹 포함) (new)
- **목표:** **공개** 글 렌더 경로를 종단간 정적 캐시 가능하게. `force-dynamic` 제거, `revalidate` 추가(무효화는 `posts.ts`의 `revalidatePath`로 이미 연결됨), post/series 읽기를 `createPublicClient`로 전환, series를 캐시 로더에 병합, 그리고 관리자 미리보기가 `E-ADMIN-PREVIEW`에 있으니 **`getUser()`/`is_admin` 게이트 제거** → `visibility='public'`만 서빙(PERF-H-1, PERF-H-3). ISR 회귀 방지를 위해 두 서브트리 항목 처리:
  - **조회수 트래킹:** `trackView`가 렌더 중 `headers()` 사용(`views.ts:12`) — 캐시 렌더 경로 밖으로 이동(클라이언트 fire-and-forget 또는 Route Handler).
  - **댓글 신선도(회귀 가드):** `components/Comments.tsx:11`이 `createClient()`로 댓글 목록을 서버 렌더; 이 읽기가 ISR 산출물에 구워지면 새/수정/삭제 댓글이 재검증 전까지 다른 독자에게 안 보임 — 현행 매 요청 읽기 대비 회귀. 댓글을 **ISR 캐시 밖에서 읽는 클라이언트 fetch island**로 만들어 수정: 작은 public Route Handler(예: `app/api/posts/[slug]/comments/route.ts`, `createPublicClient` 사용)를 `CommentList`가 마운트 시 fetch → 글 셸은 ISR 캐시되지만 댓글은 라이브 유지. 매 댓글마다 글 전체를 `revalidatePath`하는 방식으로 풀지 **말 것**(ISR 무력화 + `app/actions/comments.ts` 소유권이 `E-COMMENT-*`와 얽힘).
- **소유:** `app/posts/[slug]/page.tsx`, `components/Comments.tsx`, `components/CommentList.tsx`(클라이언트 fetch 배선), `app/api/` 하위 신규 댓글 Route Handler, `app/actions/views.ts`(또는 신규 view-tracking Route Handler / 클라이언트 트리거).
- **건드리지 말 것:** 피드 페이지, `lib/categories.ts`, `app/actions/comments.ts` 및 댓글 *mutation* RPC(`E-COMMENT-*`), 관리자 미리보기 라우트(`E-ADMIN-PREVIEW`). (참고: 글 라우트는 `Layout rightAside={<PostToc/>}`라 기본 `SideWidgets` 미렌더 → `E-WIDGETS`는 의존 **아님**.)
- **의존:** `E-PUBLIC`, `#3`, `E-ADMIN-PREVIEW`(공개 라우트가 auth 게이트를 버리기 전에 미리보기 라우트가 존재해야 함).
- **수용조건:** `next build`에서 글 라우트 ISR; **캐시** 렌더 서브트리에 `cookies()`/`headers()` 없음; 공개 글만 서빙(비공개 → 404); series 쿼리가 병렬 배치에 합류; 조회수 여전히 기록(재설계 후 조회 증가 검증); **다른 방문자가 단 댓글이 글 재검증을 기다리지 않고 표시됨**(댓글은 ISR 캐시 밖에서 fetch — 검증).

### E-AUTHEDGE — fix(auth): 미들웨어 redirect 시 갱신된 쿠키 보존 (+ REV-M-1/M-2) (#7 rescope)
- **목표:** 갱신된 Supabase 인증 쿠키를 `supabaseResponse`에서 모든 `NextResponse.redirect`로 복사(AR-H-2); admin 요청당 `profiles.is_admin`을 한 번만 조회(REV-M-1); `safeBearerEqual` 길이 분기 타이밍 강화(REV-M-2).
- **소유:** `lib/supabase/middleware.ts`, `app/api/cron/digest/route.ts`.
- **건드리지 말 것:** UI 컴포넌트, route 페이지, Supabase 팩토리.
- **의존:** —
- **수용조건:** redirect 응답이 로테이션된 쿠키를 포함(갱신 후 redirect의 `Set-Cookie` 확인); admin 요청당 `profiles` 쿼리 1회; 타이밍 균일 bearer 비교.
- **노트:** #7의 REV-M-1/M-2 흡수; REV-M-3 → `E-A11Y-INERT`. #7 **supersede**.

### E-A11Y-INERT — fix(a11y): 닫힘 시 모달/드로어 inert (new)
- **목표:** 닫힌 오버레이의 키보드 접근 차단: `PublishModal`을 조건부 렌더(또는 `inert`+`hidden`)로 게이팅해 닫힘 시 `submit` 버튼 도달 불가(CMP-H-1); `CategoryDrawer` 닫힘 시 `inert` 적용(CMP-H-2/REV-M-3); `useFocusTrap` 강화(`document` 바인딩 / 페이지 `inert`와 병행).
- **소유:** `components/PublishModal.tsx`, `components/CategoryDrawer.tsx`, `lib/use-focus-trap.ts`, `app/admin/posts/new/NewPostForm.tsx`, `app/admin/posts/[id]/edit/EditPostForm.tsx`.
- **건드리지 말 것:** 댓글 컴포넌트, Supabase 레이어, routes.
- **의존:** —
- **수용조건:** 모달/드로어 닫힘 시 Tab이 해당 컨트롤에 절대 도달 안 함(실제 Chrome 검증); 키보드로 발행 트리거 불가; 스크린리더 + 키보드 포커스 순서 일치.

### E-MD-SPACING — fix(markdown): 렌더된 글 본문의 표준 읽기 리듬 (new; 사용자 요청)
- **목표:** 렌더된 글 마크다운의 줄 간격이 어색하다. 원인 실측: `components/MarkdownView.tsx:123`이 `remarkBreaks`를 활성화해 **모든 단일 개행을 하드 `<br>`로** 변환 → 관례적 형태(단일 개행 → 소프트 랩, 빈 줄 → 새 문단) 대비 줄 간격이 좁고 불규칙. 일반적인 GitHub/블로그 렌더링으로 조정: `remarkBreaks` 재검토/제거(또는 의도적·일관 사용) + `.craft-prose`(`app/globals.css:30-31`, 현재 순수 `prose`; compact 모드는 `1.6`)의 `line-height` + 문단 마진을 편안한 표준값으로 튜닝.
- **소유:** `components/MarkdownView.tsx`(remark 플러그인 설정만), `app/globals.css`(`.craft-prose` 간격/line-height).
- **건드리지 말 것:** sanitize 스키마 / rehype 보안 순서(`rehypeSanitize` 마지막 유지), ISR/데이터 경로(`E-ISR-POST`가 페이지 소유, 이 컴포넌트 아님), 프리뷰 일관성 외 관리자 에디터 내부.
- **의존:** —
- **수용조건:** 기존 글들이 표준 문단/줄 리듬으로 렌더(실제 Chrome before/after 검증, `feedback_verify_ui_in_browser`); 보안 회귀 없음(sanitize 순서 불변); 관리자 에디터 **프리뷰**가 공개 뷰와 시각적으로 일관. **호환 확인:** 단일 개행 줄바꿈에 의존하던 기존 글(목록·주소·시)이 여전히 읽을 만한지 확인 — 하드브레이크를 작성자용으로 의도적으로 유지한다면 간격은 CSS로만 조정.

### E-COMMENT-RPC — security(comments): anon RPC용 DB-side 남용 차단 (#4 → 분할 A; SEC-H-1)
- **목표:** RPC가 실제로 도달 가능한 곳에서 남용 차단 — `SECURITY DEFINER` `insert/update/delete_comment` RPC 내부에 per-IP throttle + 최소 비밀번호 엔트로피를 넣어, anon key로 `/rest/v1/rpc/*`를 직접 호출해도 브루트포스/스팸 불가하게. (SEC-H-1)
- **소유:** 신규 `supabase/migrations/<다음 가용 번호>_comment_abuse_control.sql`, `app/actions/comments.ts`(서버측 연동만).
- **건드리지 말 것:** `lib/comment-tokens.ts`, `components/CommentForm.tsx`(그건 `E-COMMENT-TOKEN`); `database.types.ts`(재생성은 `#6-types`).
- **의존:** `E-EXTRACT`(`comments.ts` 공유).
- **수용조건:** anon key로 `update_comment`/`insert_comment` raw REST 호출 시 DB에서 레이트리밋/엔트로피 게이팅됨(실증); 최소 비밀번호 길이 상향.

### E-COMMENT-TOKEN — security(comments): 편집 토큰 만료 + 회전 (#4 → 분할 B)
- **목표:** 게스트 편집 토큰 만료·회전: `localStorage` 항목에 `createdAt`을 넣어 자동 폐기; DB가 편집/삭제 RPC에서 시간창(예: 7일) 강제; 댓글 UI 최소 길이 상향. (#4)
- **소유:** `lib/comment-tokens.ts`, `components/CommentForm.tsx`, `app/actions/comments.ts`(토큰 시간창 체크), 신규 `supabase/migrations/<다음 가용 번호>_comment_token_expiry.sql`.
- **건드리지 말 것:** `E-COMMENT-RPC`의 abuse-throttle RPC 내부(시간창 체크만 가산적으로 추가); `database.types.ts`.
- **의존:** `E-COMMENT-RPC`(공유 `comments.ts` + 댓글 마이그레이션 직렬화).
- **수용조건:** 편집 토큰이 클라이언트·DB 양쪽에서 만료; 만료 토큰 거부; UI 최소 길이 강제.

### E-TESTS — chore(test): 테스트 하네스 + 고가치 테스트 (new; #6의 테스트 절반)
- **목표:** MNT-H-1 해소 — `E-EXTRACT` 덕분에 테스트 가능해진 보안상 중요 로직에 회귀 방지망. vitest 도입; `buildTree`/`collectDescendantIds`(`lib/category-tree.ts`), 추출된 `sanitize`/`escapeLike`/`stripUnsafe`·validators, `next.config.mjs` `headers()` 스냅샷(CSP/HSTS/remotePatterns 고정), Playwright `/admin` 게이트 스모크(비인증→login, 비관리자→home) 단위 테스트.
- **소유:** `__tests__/**`, `vitest.config.ts`, `playwright.config.ts`, `package.json`(**`test`/`test:e2e` 스크립트 + 테스트 `devDependencies`만**).
- **건드리지 말 것:** 모든 런타임 소스 파일(테스트는 import만, 수정 안 함); 런타임 `react`/`next` 버전(`#5`); Supabase 타이핑(`#6-types`). **§6 백로그로 이연**(Medium/Low, 이 이슈 아님): `noUncheckedIndexedAccess`, `@typescript-eslint`, `package.json` `name` 변경.
- **의존:** `E-EXTRACT`(추출된 순수 모듈 대상), `E-AUDIT`(공유 `package.json`).
- **수용조건:** `npm test` 로컬 green; 위 순수 함수 커버; headers 스냅샷이 CSP/HSTS/remotePatterns 고정; admin-gate 스모크 통과; 런타임 `.ts`/`.tsx` 미변경.
- **규모 노트:** Playwright 하네스가 무거우면 `E-TESTS`(vitest 단위 + 스냅샷)와 별도 e2e 스모크 이슈로 분할 가능; 기본은 한 PR.

### #6-types — chore(types): `supabase gen types`로 타입 있는 Supabase 클라이언트 (#6 rescope; 늦은 consolidation)
- **목표:** **최종** 스키마에서 `Database` 타입을 생성하고 네 클라이언트 팩토리 모두에 `<Database>`를 적용, 불안전 캐스트 제거. (MNT-H-2) 늦게 실행해 모든 신규 RPC/컬럼을 보게 하고 다른 이슈가 타입을 재생성할 필요를 없앰.
- **소유:** 신규 `lib/supabase/database.types.ts`, `lib/supabase/{server,client,admin,public}.ts`(`<Database>` 추가), `components/widgets/RecentComments.tsx`(`as unknown as` 제거).
- **건드리지 말 것:** route 파일, 마이그레이션(적용된 스키마 read만), 테스트 셋업.
- **의존:** `E-PUBLIC`, `E-WIDGETS`(`RecentComments.tsx` 공유), `#3`, `E-COMMENT-RPC`, `E-COMMENT-TOKEN`(모든 스키마 반영 후).
- **수용조건:** 모든 팩토리에 `createClient<Database>()`(및 public); `as unknown as CommentRow[]` 제거; `tsc` clean; `types:gen` npm 스크립트 문서화.
- **노트:** #6은 **3분할** — 추출→`E-EXTRACT`, 테스트→`E-TESTS`, 타이핑→이 이슈.

### #5 — chore(deps): React 19 + 보안 요구 Next 업그레이드 (#5 rescope; sink)
- **목표:** 프레임워크 메이저: codemod(`params`/`searchParams` promise화), `useFormState`→`useActionState`, `eslint-config-next` 메이저(dev-only `glob` CVE), 그리고 **권고가 요구하는 버전까지 Next 상향** — `npm audit --json`이 SEC-H-2에 대해 현재 `fixAvailable: next@16.x`를 표시하므로 목표는 고정된 "15"가 아니라 "audit High clean".
- **소유:** `package.json`(런타임 `react`/`next`/`eslint-config-next`), `package-lock.json`, codemod가 건드리는 파일 전역, `components/CommentForm.tsx`(`useActionState`).
- **건드리지 말 것:** — (모든 것 위에 리베이스).
- **의존:** **다른 모든 이슈** — sink 노드, 프레임워크 메이저가 다른 모든 PR을 강제 리베이스하지 않도록 맨 마지막에 착지.
- **수용조건:** 업그레이드된 React/Next에서 빌드·구동; `npm audit` High clean; `useActionState` 이전; markdown/editor/og 의존성 호환 확인; 업그레이드 후 `E-TESTS` 스위트 여전히 green.

## 6. Medium/Low 백로그 (문서화, 이슈화 안 함)

정확성: 피드 커서에 `id` 타이브레이커 없음(타임스탬프 경계에서 중복/누락); `feed.ts` 필터 후 빈 배열이면 전역 피드로 폴백; `draft-${Date.now()}` slug가 초안 재저장 시 재작성; digest "…외 N건"이 `MAX_COMMENTS` 초과분 누락; `robots.ts`가 `site.url` 대신 raw env 사용.
성능: **RSS/sitemap ISR no-op** — `app/rss.xml/route.ts`(`revalidate=600`)와 `app/sitemap.ts`가 쿠키 바인딩 `createClient()`로 공개 글을 읽음(실측), AR-H-1과 동일한 죽은 `revalidate` 부류지만 저트래픽 SEO 엔드포인트; `createPublicClient`를 기회적으로 도입(후속 "public-read cleanup" 후보); **태그 페이지 무한스크롤**(`InfinitePostList`/`loadMorePosts` 태그필터 계약 필요 — `E-ISR-FEED`에서 이연); 위젯에 `Suspense` 없음; 동적 라우트에 스트리밍 없음; `profile.jpeg` 581KB를 48px 슬롯에 `priority`로; 첫 피드 카드 이미지에 `priority` 없음; 전역 `highlight.js` CSS import; `formatDate` ×3 중복; `RecentComments` 오버페치.
보안: `track_post_view`가 클라이언트 `p_visitor_hash`를 신뢰(분석 조작); 관리자 로그인에 앱 레벨 브루트포스 캡 없음; CSP `unsafe-inline`(문서화된 트레이드오프).
유지보수/툴링(`E-TESTS`에서 이연): `tsconfig` `noUncheckedIndexedAccess`(repo-wide 파장 — 자체 패스); `@typescript-eslint` 타입 인지 ESLint; `package.json` `"name":"nextjs-bootstrap"` 변경; `.github/workflows/` CI 없음(`E-TESTS` 착지 후 `npm test` 배선); 갈라진 두 `ActionState` 타입; visibility 필터 + select 컬럼 목록 ~16곳 중복; `ThemeToggle` 비동기화 위험; `MarkdownEditor` 인라인 `components.preview`.

## 7. 에픽 non-goals

- 여기서 수정 코드를 쓰지 않음 — 마일스톤 + 이슈 DAG만(수정은 `/lead-issue`).
- Medium/Low 항목은 이슈화 **안 함**(위에 기록).
- 새 유료/종량제 서비스 없음(`feedback_no_paid_billing`).
- auth/댓글 모델이나 비주얼 디자인 재설계 없음 — 현재 구현의 하드닝만.
- nonce 기반 CSP 마이그레이션 없음(문서화된 트레이드오프).

## 8. 분해 리뷰 트레일 (fresh eyes)

`review-decomposition` 총 7라운드(R1–R4·R6 = REVISE, R5·R7 = PASS); 모든 발견사항을 코드로 검증해 반영:
- **R1:** 마이그레이션 번호(010 사용 중), 타입-vs-마이그레이션 재생성, `#5` 조기 감사 모순, 과대 `E-TESTS` → `E-AUDIT` 추가, `E-TESTS` 축소, `feed.ts` 소유권 명시, lockfile 주장 정정(`package-lock.json` 존재).
- **R2:** `E-ISR-POST` 불완전(Comments/trackView가 여전히 cookie-bound — 실측), 태그 페이지네이션에 `InfinitePostList` 계약 필요(`.limit()`로 범위 축소, 무한스크롤 → 백로그), `E-TESTS`가 비-export 함수 대상(→ 신규 `E-EXTRACT`), `database.types.ts` 병렬 재생성(→ `#6-types`를 늦은 consolidation으로 **역전**), `#5` 감사 타겟(→ 권고 요구 Next 버전으로 재설정), `E-COMMENT-SEC` 과대(→ `E-COMMENT-RPC` + `E-COMMENT-TOKEN`로 분할).
- **R3:** 검증된 결함 2건 — 기본 `<SideWidgets/>` 위젯이 여전히 쿠키 바인딩 `createClient()` 호출(→ 신규 `E-WIDGETS`); `#3`의 `categories` 캐시 태그를 **글** mutation도 무효화해야 함(`category_post_counts`가 공개 글 집계 → `#3`이 `app/actions/posts.ts`의 `revalidateTag` 호출 소유). 순환 없음; `#6-types` 늦은 결정 정당함 재확인.
- **R4:** `E-ISR-POST → E-WIDGETS`는 **거짓 의존**(글 라우트가 `rightAside={<PostToc/>}` 사용, 기본 위젯 없음 — 실측) → 제거; `/posts/[slug]`가 관리자 비공개/초안 미리보기를 겸함(실측 `page.tsx:27-43`, 관리자 링크 `posts/page.tsx:94`) → 신규 `E-ADMIN-PREVIEW`로 분리, `E-ISR-POST`를 게이팅; RSS/sitemap이 동일한 쿠키 바인딩 `revalidate` no-op 공유 → §6 백로그 추가. `E-ISR-POST`를 공개 경로만으로 재범위.
- **R5: PASS** — 분해 견고; 커버리지 갭 없음, 순환 없음, 공유 파일 의존성으로 직렬화, 근거 확인.
- **PASS 후 추가(사용자 요청):** `E-MD-SPACING` — 어색한 마크다운 줄 간격 수정(`remarkBreaks` 하드브레이크 + `prose` 간격). 독립 리프: `MarkdownView.tsx` + `globals.css` 소유(다른 이슈가 소유하지 않음).
- **R6:** 검증된 회귀 1건 — 글 페이지를 ISR로 만들면 **서버 렌더 댓글 목록**이 캐시됨(댓글 mutation이 `revalidatePath` 호출 안 함), 재검증 전까지 다른 사용자가 새 댓글을 못 봄. 경로 무효화 대신 댓글을 **클라이언트 fetch island**(ISR 캐시 밖에서 읽는 신규 public Route Handler)로 만들어 수정; `E-ISR-POST`가 `CommentList.tsx` + 핸들러를 소유하고 `app/actions/comments.ts`는 명시적으로 건드리지 않음(`E-COMMENT-*`와 비얽힘).
- **R7: PASS** — `E-MD-SPACING`과 댓글 신선도 수정 포함 상태에서 커버리지·의존성 순서·공유 소유권 직렬화·근거 모두 통과. 이슈 생성 진행.
