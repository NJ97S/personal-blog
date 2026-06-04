# 성능 / Next.js 베스트프랙티스 리뷰

> **리뷰 대상**: personal-blog 전체 소스 (Next.js 14.2.35, Supabase, React 18)
> **리뷰 일시**: 2026-06-01
> **리뷰어**: Claude Opus 4.6 (code-reviewer)

---

## 요약

### 핵심 발견

1. **커스텀 폰트(kkukkukk) 2.25MB WOFF2** — 전체 페이지 LCP를 크게 지연시키는 최대 병목입니다. 일반적인 한글 서브셋 WOFF2는 200~400KB 수준인데, 이 폰트는 약 5~10배 큽니다.
2. **홈페이지(`/`)에 `revalidate` 미설정** — `force-dynamic`도, `revalidate`도 없어 Next.js 14 기본값(fetch 캐시 on, 풀 라우트는 매 요청 dynamic)에 따라 매 요청마다 Supabase 쿼리 2건이 실행됩니다. TTFB에 직접적 영향을 줍니다.
3. **게시글 상세(`/posts/[slug]`) `force-dynamic` + 직렬 워터폴** — `generateMetadata`에서 1건 쿼리, `PostPage`에서 4건 쿼리가 순차적으로 실행됩니다. ISR로 전환하면 TTFB를 극적으로 개선할 수 있습니다.
4. **태그 페이지(`/tags/[tag]`)에 `.limit()` 미사용** — 태그에 글이 수백 건 붙으면 전체를 한 번에 가져옵니다.
5. **`MarkdownView`가 RSC에서 렌더링되지만 `rehype-highlight`가 모든 언어를 번들에 포함** — highlight.js의 전체 언어팩(~180KB gzip)이 서버/클라이언트 양쪽에 포함됩니다.

### 예상 영향 (Web Vitals)

| 지표 | 영향도 | 주요 원인 |
|------|--------|-----------|
| **LCP** | 🔴 높음 | 2.25MB 폰트 다운로드, 커버 이미지 priority 설정은 양호 |
| **TTFB** | 🔴 높음 | 홈/게시글 상세 매 요청 Supabase 쿼리, ISR 미적용 |
| **CLS** | 🟢 낮음 | font-display:swap + adjustFontFallback 적용으로 양호 |
| **INP** | 🟡 보통 | MarkdownView 재렌더 비용, InfinitePostList 스크롤 시 fetch |

---

## 발견사항

### 🔴 Critical

#### C1. 커스텀 폰트 파일 크기 2.25MB — LCP 직접 영향
- **파일**: `app/fonts/memoment-kkukkukk.woff2` (2,359,608 bytes)
- **파일**: `app/layout.tsx:8-16`
- **문제**: `preload: true`로 설정되어 있어 **모든 페이지에서 2.25MB를 즉시 다운로드**합니다. 3G 환경에서 약 6~8초, LTE에서도 1~2초의 추가 지연이 발생합니다. 일반적인 한글 WOFF2 서브셋은 200~400KB입니다.
- **영향**: LCP +1~8초 (네트워크 환경별)
- **수정 제안**:
  1. **글리프 서브셋팅**: `pyftsubset` 또는 `fonttools`로 실제 사용 글리프만 추출합니다. 블로그 UI에 사용되는 한글 자모/완성형 + 기본 Latin만 남기면 200~400KB로 줄일 수 있습니다.
  2. **`preload: false`로 변경**: 본문에만 사용한다면 preload를 끄고 `display: 'swap'`만 유지하는 것도 방법입니다.
  3. **font subsetting service**: Google Fonts의 unicode-range 방식처럼 range별 분할 로딩 고려합니다.
- **예상 절감**: ~1.8MB (~80% 감소), LCP 1~6초 개선

---

### 🟠 High

#### H1. 홈페이지(`/`) ISR/revalidate 미설정 — 매 요청 Supabase 쿼리
- **파일**: `app/page.tsx` (전체, segment config export 없음)
- **문제**: `export const revalidate`도 `export const dynamic`도 설정되어 있지 않습니다. Next.js 14 App Router에서 `cookies()`를 사용하는 `createClient()`를 호출하므로 자동으로 dynamic rendering이 됩니다. 결과적으로 매 요청마다 Supabase에 2건의 쿼리(posts + categories)가 실행됩니다.
- **영향**: TTFB +100~300ms (Supabase 리전 거리에 따라 다름)
- **수정 제안**:
  ```typescript
  // app/page.tsx 상단에 추가
  export const revalidate = 60 // 60초 ISR
  ```
  단, `createClient()`가 `cookies()`를 호출하므로 ISR과 호환되지 않습니다. 홈페이지 전용으로 `createAdminClient()` 또는 cookie 없는 anon 클라이언트를 만들어야 합니다. 또는 `unstable_cache`로 데이터 페칭을 감싸는 방법이 있습니다.
- **예상 개선**: TTFB 100~300ms 감소, Supabase 부하 90%+ 감소

#### H2. 게시글 상세 페이지 `force-dynamic` + 쿼리 워터폴
- **파일**: `app/posts/[slug]/page.tsx:17,85-146`
- **문제**:
  1. `export const dynamic = 'force-dynamic'`으로 ISR 완전 비활성화되어 있습니다.
  2. `generateMetadata()`에서 1건 쿼리 후, `PostPage()`에서 추가 쿼리가 실행됩니다 — 동일 slug로 **같은 데이터를 두 번** 가져옵니다.
  3. `PostPage` 내부에서 `getUser()` → `profile` 조회 → `postQuery + fetchCategoryTree` (Promise.all) → `seriesPosts` 쿼리 순으로 **4단계 워터폴**이 발생합니다 (`getUser`, profile이 먼저 완료되어야 postQuery 조건이 결정됨).
- **영향**: TTFB +200~500ms
- **수정 제안**:
  1. **ISR 전환**: `export const revalidate = 3600` + `generateStaticParams`를 추가하여 인기 글을 사전 빌드합니다.
  2. **`generateMetadata`와 `PostPage`의 데이터 공유**: React `cache()` 함수로 slug별 데이터 페칭을 감싸면 동일 렌더링 패스에서 자동 중복 제거됩니다.
  3. **워터폴 해소**: 비로그인 사용자(대다수)를 위한 빠른 경로를 만들어 auth 체크 없이 바로 `postQuery`를 실행합니다.

  ```typescript
  // 예시: cache()로 중복 쿼리 제거
  import { cache } from 'react'
  const getPost = cache(async (slug: string) => {
    const supabase = createClient()
    return supabase.from('posts').select('...').eq('slug', slug).maybeSingle()
  })
  ```

#### H3. `MarkdownView` — rehype-highlight 전체 언어팩 번들 포함
- **파일**: `components/MarkdownView.tsx:6`
- **문제**: `import rehypeHighlight from 'rehype-highlight'`는 highlight.js의 **전체 언어 팩**(약 190개 언어)을 포함합니다. MarkdownView는 RSC(Server Component)로 렌더링되므로 서버 사이드 번들에만 포함되지만, 관리자 에디터에서 `MarkdownEditor.tsx`를 통해 클라이언트에서도 사용됩니다.
- **영향**: 서버 번들 +180KB gzip, 클라이언트(에디터 페이지) +180KB gzip
- **수정 제안**:
  1. `rehype-highlight`에 `languages` 옵션으로 실제 사용 언어만 등록합니다:
  ```typescript
  import rehypeHighlight from 'rehype-highlight'
  import javascript from 'highlight.js/lib/languages/javascript'
  import typescript from 'highlight.js/lib/languages/typescript'
  import python from 'highlight.js/lib/languages/python'
  // ... 필요한 언어만
  const rehypeHighlightOpts = { languages: { javascript, typescript, python } }
  ```
  2. 또는 `@shikijs/rehype`로 교체하면 빌드 타임에 하이라이팅하여 클라이언트 JS 0으로 만들 수 있습니다.
- **예상 절감**: ~150KB gzip (에디터 페이지 기준)

#### H4. 태그 페이지 `.limit()` 미사용 — 무제한 결과 반환
- **파일**: `app/tags/[tag]/page.tsx:34-43`
- **문제**: 태그별 게시글을 가져올 때 `.limit()`이 없습니다. 특정 태그에 수백 건의 글이 연결되면 모두 한 번에 가져와 서버 메모리와 응답 크기에 부담을 줍니다.
- **영향**: TTFB 및 메모리 사용량 증가 (글 수에 비례)
- **수정 제안**: InfinitePostList 패턴을 적용하거나 최소한 `.limit(100)`을 추가합니다.

---

### 🟡 Medium

#### M1. `fetchCategoryTree()`의 `cache()` — 요청 범위 한정
- **파일**: `lib/categories.ts:12`
- **문제**: React `cache()`는 **단일 렌더링 패스(요청) 내에서만** 중복을 제거합니다. 여러 요청 간 캐싱에는 `unstable_cache`가 필요합니다. 카테고리 트리는 자주 변경되지 않으므로 `unstable_cache`로 감싸면 DB 호출을 크게 줄일 수 있습니다.
- **영향**: 요청당 불필요한 DB 쿼리 2건 (categories + category_post_counts)
- **수정 제안**:
  ```typescript
  import { unstable_cache } from 'next/cache'
  export const fetchCategoryTree = unstable_cache(
    async () => { /* 기존 로직 */ },
    ['category-tree'],
    { revalidate: 300, tags: ['categories'] }
  )
  ```

#### M2. `PostCard` 이미지 — `loading="lazy"` 기본값이지만 첫 화면 이미지 LCP 후보
- **파일**: `components/PostCard.tsx:53-58`
- **문제**: PostCard의 Image에 `priority`가 없습니다. 첫 화면(above-the-fold)에 보이는 첫 번째 카드의 커버 이미지가 LCP 후보인데, `loading="lazy"`(기본값)로 지연 로딩됩니다.
- **영향**: LCP +100~300ms
- **수정 제안**: InfinitePostList에서 첫 번째 아이템에만 `priority` prop을 전달합니다.

#### M3. `CategorySidebar`의 프로필 이미지 `priority` 불필요
- **파일**: `components/CategorySidebar.tsx:19`
- **문제**: 사이드바의 48x48 프로필 이미지에 `priority`가 설정되어 있습니다. 이 작은 이미지(581KB)는 LCP 후보가 아니므로 `priority`를 제거하면 더 중요한 리소스에 대역폭을 양보할 수 있습니다.
- **참고**: `profile.jpeg`가 581KB인데 48x48로 표시됩니다. 100x100 정도로 리사이즈하면 ~5KB로 줄일 수 있습니다.
- **수정 제안**: `priority` 제거 + 이미지 리사이즈

#### M4. SideWidgets 내 3개 서버 컴포넌트 — 순차 워터폴
- **파일**: `components/SideWidgets.tsx:6-14`, `widgets/PopularPosts.tsx`, `widgets/RecentPosts.tsx`, `widgets/RecentComments.tsx`
- **문제**: SideWidgets는 서버 컴포넌트 3개(PopularPosts, RecentPosts, RecentComments)를 포함합니다. 이들은 각각 별도의 Supabase 쿼리를 실행하는데, 서버 컴포넌트의 렌더링 특성상 **순차적**으로 실행될 수 있습니다 (React의 서버 컴포넌트 렌더링은 트리 순서를 따릅니다).
- **영향**: TTFB +50~150ms (3건 쿼리 순차 실행)
- **수정 제안**: 각 위젯을 `<Suspense>` 경계로 감싸 스트리밍하거나, 데이터를 SideWidgets에서 `Promise.all`로 병렬 fetch한 뒤 props로 내려줍니다.

#### M5. `highlight.js` CSS 전역 임포트
- **파일**: `app/globals.css:1`
- **문제**: `@import 'highlight.js/styles/github-dark.css'`가 전역 CSS에 포함되어 코드 블록이 없는 페이지에서도 로딩됩니다. highlight.js CSS는 ~3KB gzip으로 크지 않지만, 불필요한 리소스입니다.
- **수정 제안**: MarkdownView 컴포넌트 수준에서 import하거나, 필요한 페이지에서만 로딩합니다.

#### M6. `generateMetadata`와 페이지 함수의 중복 Supabase 쿼리
- **파일**: `app/posts/[slug]/page.tsx:41-50` (generateMetadata) 및 `app/posts/[slug]/page.tsx:85-115` (PostPage)
- **문제**: `generateMetadata`에서 slug로 post를 조회하고, `PostPage`에서 **동일한 slug**로 다시 조회합니다. Next.js 14에서 fetch 자동 중복 제거는 `fetch()` API에만 적용되며, Supabase 클라이언트의 `.from().select()`는 해당되지 않습니다.
- **영향**: 매 요청 불필요한 DB 쿼리 1건 추가
- **수정 제안**: React `cache()`로 slug별 조회 함수를 감쌉니다 (H2 제안 참조).

#### M7. `trackView()` 가 렌더링 시 await — TTFB 증가
- **파일**: `app/posts/[slug]/page.tsx:117-119`
- **문제**: `await trackView(post.id)`가 페이지 렌더링 도중 호출됩니다. 조회수 기록은 사용자 응답에 영향을 주지 않으므로 await 없이 fire-and-forget으로 호출해야 합니다.
- **영향**: TTFB +20~80ms (RPC 호출 대기)
- **수정 제안**:
  ```typescript
  // await 제거 — fire-and-forget
  if (!isAdmin && post.visibility === 'public') {
    trackView(post.id) // no await
  }
  ```
  또는 `waitUntil()` (Vercel에서 지원)을 사용합니다.

---

### 🟢 Low

#### L1. `PostCard` 내 `formatDate()` — 매 렌더마다 `Intl.DateTimeFormat` 생성
- **파일**: `components/PostCard.tsx:16-26`, `app/posts/[slug]/page.tsx:20-30`
- **문제**: `formatDate` 함수가 여러 파일에 중복 정의되어 있으며, 매 호출마다 `toLocaleDateString()`을 통해 내부적으로 `Intl.DateTimeFormat` 인스턴스를 생성합니다.
- **수정 제안**: 공유 유틸리티로 추출하고, `Intl.DateTimeFormat` 인스턴스를 모듈 레벨에서 캐싱합니다:
  ```typescript
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
  })
  export function formatDate(iso: string) { return dateFormatter.format(new Date(iso)) }
  ```

#### L2. `CommentList` 초기 댓글 200건 제한
- **파일**: `components/Comments.tsx:17`
- **문제**: `.limit(200)`으로 최대 200건의 댓글을 한 번에 가져옵니다. 일반적인 블로그 글에는 충분하지만, 인기 글에서 JSON 페이로드가 커질 수 있습니다.
- **수정 제안**: 페이지네이션 또는 "더 보기" 패턴 적용을 고려합니다.

#### L3. `@uiw/react-md-editor` CSS 전역 import
- **파일**: `components/MarkdownEditor.tsx:7`
- **문제**: `@uiw/react-md-editor/markdown-editor.css`가 import되어 있지만, 컴포넌트 자체는 `dynamic(() => import(...), { ssr: false })`로 로딩됩니다. CSS는 dynamic import에 포함되지 않고 별도로 번들에 포함될 수 있습니다. 다만 이 컴포넌트는 admin 전용이므로 공개 페이지에는 영향이 없습니다.

#### L4. `useHydrated` 훅 — 미미한 CLS 가능성
- **파일**: `lib/use-hydrated.ts`
- **문제**: 하이드레이션 전후로 버튼 disabled 상태가 변경되어 미미한 레이아웃 시프트가 발생할 수 있습니다. 실제로는 disabled 속성만 변경되므로 CLS 영향은 거의 없습니다.

---

### ℹ️ Info / 개선 제안

#### I1. `generateStaticParams` 미사용
- **파일**: `app/posts/[slug]/page.tsx`
- **현황**: `export const dynamic = 'force-dynamic'` 때문에 `generateStaticParams`가 없습니다.
- **제안**: ISR 전환 시 `generateStaticParams`로 인기/최신 글을 빌드 타임에 사전 생성하면 첫 방문 TTFB를 제거할 수 있습니다.

#### I2. `remotePatterns: hostname '**'` — 보안/성능 이중 이슈
- **파일**: `next.config.mjs:4`
- **현황**: `{ protocol: 'https', hostname: '**' }`는 모든 HTTPS 호스트의 이미지를 허용합니다. Next.js Image Optimization이 모든 외부 호스트에 대해 작동하므로 서버 리소스를 소비하게 됩니다.
- **제안**: 실제 사용하는 이미지 호스트(예: Supabase Storage, 특정 CDN)만 허용합니다.

#### I3. Suspense 경계 부족
- **현황**: `loading.tsx`가 루트(`/`)와 `posts/[slug]`에만 있습니다. 카테고리, 태그, 검색 페이지에는 없어 네비게이션 시 빈 화면이 잠시 보일 수 있습니다.
- **제안**: 각 라우트에 `loading.tsx` 추가, 또는 위젯 영역에 `<Suspense fallback={<Skeleton/>}>`을 적용합니다.

#### I4. `PostToc` 클라이언트 DOM 조회 기반
- **파일**: `components/PostToc.tsx:12-25`
- **현황**: `useEffect`에서 `document.querySelector('article')`로 heading을 수집합니다. 이는 하이드레이션 완료 후에야 동작하므로, 서버에서 목차를 미리 렌더링할 수 없습니다.
- **제안**: 마크다운 파싱 단계에서 heading 목록을 추출하여 서버에서 TOC를 렌더링하면, CLS를 방지하고 SEO에도 유리합니다.

#### I5. `searchParams` 처리 — Next.js 14.2 호환 확인
- **파일**: `app/search/page.tsx:22,30`
- **현황**: `searchParams`를 직접 객체로 받고 있으며 이는 Next.js 14에서 정상 동작합니다. Next.js 15에서는 `searchParams`가 Promise가 되지만, 현재 14.2.35에서는 문제없습니다.

---

## 영역별 메모

### RSC/CSR 경계

**양호합니다.** 'use client' 지시자가 필요한 컴포넌트에만 적용되어 있습니다:
- 인터랙션이 필요한 컴포넌트: `InfinitePostList`, `PostToc`, `ThemeToggle`, `ShareButton`, `CategoryDrawer`, `CommentList/Form/Item`, `SeriesBox`
- 서버 컴포넌트로 유지된 것: `Layout`, `Header`, `CategorySidebar`, `Footer`, `Comments`, `PostCard`, `MarkdownView`, 모든 위젯(PopularPosts, RecentPosts, RecentComments)
- `MarkdownView`가 서버 컴포넌트인 것은 좋은 판단입니다. ReactMarkdown + rehype 플러그인 체인이 클라이언트에 전송되지 않습니다 (에디터 프리뷰 제외).

**개선 여지**: `PostCard`는 서버 컴포넌트이지만, `InfinitePostList`(클라이언트)의 자식으로 렌더링됩니다. 이 경우 PostCard의 코드가 클라이언트 번들에 포함됩니다. PostCard 자체는 가벼우므로 큰 문제는 아닙니다.

### 데이터 페칭/캐싱

**개선이 필요합니다.**
- `fetchCategoryTree()`는 React `cache()`로 요청 내 중복 제거만 합니다 — 요청 간 캐싱이 없습니다.
- 홈페이지에 `revalidate` 설정이 없어 매 요청 dynamic입니다.
- `posts/[slug]`는 `force-dynamic`으로 ISR이 완전 비활성화되어 있습니다.
- `categories/[...slug]`와 `tags/[tag]`는 `revalidate: 60`으로 적절합니다.
- `generateMetadata`와 페이지 함수 간 Supabase 쿼리 중복이 있습니다.
- 사이드 위젯 3개가 매 요청마다 DB를 조회합니다 (캐싱 없음).

### 이미지/폰트

**폰트가 최대 병목입니다.**
- kkukkukk WOFF2: 2.25MB — **반드시 서브셋팅이 필요합니다**.
- `display: 'swap'` + `adjustFontFallback: 'Times New Roman'`: CLS 방지에 좋은 설정입니다.
- JetBrains Mono: Google Fonts에서 로딩, `display: 'swap'` 적용 — 양호합니다.
- 게시글 커버 이미지: `priority` + `sizes="(min-width: 768px) 768px, 100vw"` — LCP 최적화 잘 되어 있습니다.
- PostCard 이미지: `sizes="140px"` — 적절합니다.
- 프로필 이미지: 581KB → 48x48 표시 — 리사이즈 필요합니다 (L 우선순위).

### 번들/코드 스플리팅

**양호하나 개선 여지가 있습니다.**
- `@uiw/react-md-editor` (8.7MB node_modules): `dynamic(() => import(...), { ssr: false })`로 코드 스플리팅 — **좋습니다**. admin 전용이므로 공개 페이지에 영향 없습니다.
- `lucide-react`: 개별 아이콘 import (tree-shakeable) — **양호합니다**.
- `rehype-highlight`: 전체 언어팩 포함 — 개선 필요합니다 (H3 참조).
- `react-markdown` + 플러그인 체인: 서버 컴포넌트에서 실행되므로 클라이언트 번들에 포함되지 않습니다 — **좋습니다** (에디터 페이지 제외).

### 마크다운 렌더 파이프라인

**설계가 잘 되어 있습니다.**
- `MarkdownView`가 서버 컴포넌트여서 ReactMarkdown 렌더링 비용이 클라이언트에 전가되지 않습니다.
- 플러그인 배열(`remarkPlugins`, `rehypePlugins`)이 모듈 수준 상수로 정의되어 매 렌더마다 새 배열을 생성하지 않습니다 — **좋은 패턴입니다**.
- `sanitizeSchema`도 모듈 수준 상수입니다 — **좋습니다**.
- `rehypeSourceLine` 커스텀 플러그인: 에디터 스크롤 싱크용으로만 조건부 적용 — **적절합니다**.

**개선 여지**: `rehypeHighlight` 언어팩 서브셋 (H3 참조).

### InfinitePostList

**잘 구현되어 있습니다.**
- `IntersectionObserver`의 `rootMargin: '400px 0px'`: 사용자가 끝에 도달하기 전에 미리 로딩 — **좋습니다**.
- `loadingRef`로 중복 요청 방지 — **좋습니다**.
- `seenIdsRef`로 중복 아이템 필터링 — **좋습니다**.
- cursor 기반 페이지네이션 (offset 아닌 keyset) — **좋은 패턴입니다**.
- fallback으로 "더 보기" 버튼 제공 — **좋습니다**.

**사소한 개선**: `fetchMore`를 `useCallback`으로 감싸고 있지만, `cursor`가 바뀔 때마다 새 함수가 생성되어 `useEffect`의 IntersectionObserver가 재생성됩니다. `cursor`가 자주 변경되지 않으므로 실질적 문제는 아닙니다.

### 메타데이터/SEO 성능

**잘 갖춰져 있습니다.**
- 루트 레이아웃: 정적 `metadata` export — **양호합니다** (런타임 비용 없음).
- 게시글 상세: `generateMetadata`로 동적 메타데이터 — **적절합니다**.
- Open Graph 이미지: Edge Runtime에서 `ImageResponse` — **양호합니다**.
- JSON-LD: `JsonLd` 서버 컴포넌트로 구조화 데이터 주입 — **좋습니다**.
- `sitemap.ts`, `robots.ts`, `manifest.ts`, `rss.xml/route.ts` 모두 구현 — **좋습니다**.
- 카테고리/태그 페이지: `canonical` URL 설정 — **좋습니다**.

---

## 좋은 점

1. **RSC/CSR 경계 설계가 모범적입니다.** `MarkdownView`를 서버 컴포넌트로 유지하여 무거운 마크다운 파싱+렌더링이 클라이언트에 전가되지 않습니다.

2. **`@uiw/react-md-editor`의 dynamic import**: `ssr: false`로 admin 전용 에디터를 코드 스플리팅한 것은 좋은 판단입니다.

3. **마크다운 플러그인 배열 상수화**: `remarkPlugins`, `rehypePlugins`, `sanitizeSchema`를 모듈 레벨 상수로 정의하여 불필요한 재생성을 방지합니다.

4. **InfinitePostList의 cursor 기반 페이지네이션**: offset 기반보다 성능과 일관성이 우수합니다. `seenIdsRef`로 중복 방지까지 구현되어 있습니다.

5. **Supabase 쿼리의 컬럼 선택**: `select('*')` 대신 필요한 컬럼만 명시하여 네트워크 전송량을 최소화합니다.

6. **`Promise.all`을 적절히 활용**: 홈페이지, 카테고리, 태그 페이지에서 독립적인 쿼리를 병렬로 실행합니다.

7. **font-display: swap + adjustFontFallback**: 폰트 크기 문제를 제외하면 CLS 방지 설정이 잘 되어 있습니다.

8. **보안 체계**: `rehype-sanitize`, 댓글의 `stripUnsafe()`, rate limiting, 입력 길이 제한 등 보안이 체계적으로 적용되어 있습니다.

---

## 후속 액션 권고 (효과 큰 순)

| 우선순위 | 액션 | 난이도 | 예상 효과 | 관련 항목 |
|----------|------|--------|-----------|-----------|
| 1 | **kkukkukk 폰트 서브셋팅** | 낮음 | LCP 1~6초 개선 | C1 |
| 2 | **홈페이지 ISR 적용** (`revalidate: 60`) | 중간 | TTFB 100~300ms 개선 | H1 |
| 3 | **게시글 상세 ISR 전환** + 쿼리 중복 제거 | 중간 | TTFB 200~500ms 개선 | H2, M6 |
| 4 | **`trackView()` fire-and-forget** | 낮음 | TTFB 20~80ms 개선 | M7 |
| 5 | **`fetchCategoryTree` → `unstable_cache`** | 낮음 | 요청당 DB 쿼리 2건 절감 | M1 |
| 6 | **rehype-highlight 언어 서브셋** | 낮음 | 번들 ~150KB gzip 절감 | H3 |
| 7 | **태그 페이지 `.limit()` 추가** | 낮음 | 대량 글 방지 | H4 |
| 8 | **SideWidgets Suspense 스트리밍** | 중간 | TTFB 50~150ms 개선 | M4 |
| 9 | **프로필 이미지 리사이즈** | 낮음 | ~576KB 절감 | M3 |
| 10 | **PostCard 첫 이미지 priority** | 낮음 | LCP 100~300ms 개선 | M2 |

### 예상 종합 효과
- **LCP**: 1~6초 개선 (폰트 서브셋팅이 지배적)
- **TTFB**: 300~800ms 개선 (ISR + 워터폴 해소 + fire-and-forget)
- **번들 크기**: ~150KB gzip 절감 (highlight.js 서브셋)
- **DB 부하**: 요청당 3~5건 쿼리 절감 (ISR + unstable_cache + 중복 제거)
