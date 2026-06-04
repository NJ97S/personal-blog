# App Router 페이지 코드리뷰

## 요약
- 검토 범위: 14개 파일 (`app/layout.tsx`, `app/page.tsx`, `app/loading.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/rss.xml/route.ts`, `app/posts/[slug]/page.tsx`, `app/posts/[slug]/loading.tsx`, `app/posts/[slug]/opengraph-image.tsx`, `app/categories/[...slug]/page.tsx`, `app/tags/[tag]/page.tsx`, `app/search/page.tsx`)
- 핵심 발견:
  - 검색 페이지에서 PostgREST `ilike` 필터에 사용자 입력이 와일드카드 문자(`%`, `_`)를 포함할 수 있는 injection 경로가 존재합니다.
  - RSS CDATA 섹션에서 `]]>` 시퀀스를 포함하는 제목/본문에 대한 이스케이프가 누락되어 XML 파싱 에러를 유발할 수 있습니다.
  - `encodeURI` vs `encodeURIComponent` 혼용으로 특수 문자가 포함된 slug에서 URL 깨짐 가능성이 있습니다.
  - `not-found.tsx`, `error.tsx` 경계 파일이 전역 및 주요 라우트에 부재하여 예외 시 사용자 경험이 불안정할 수 있습니다.

## 발견사항

### 🔴 Critical

해당 없습니다.

### 🟠 High

- **[app/search/page.tsx:69] PostgREST ilike 와일드카드 injection**
  - 설명: `sanitize()` 함수(라인 13-19)가 PostgREST 문법 문자(`.`, `,`, `(`, `)` 등)는 잘 차단하고 있으나, SQL `LIKE` 패턴의 와일드카드 문자인 `%`와 `_`는 정규식에서 제거 대상에 포함되지 않습니다. 하지만 라인 17의 정규식 `[^a-zA-Z0-9가-힣ㄱ-ㆎ\s\-_]`을 보면 `%`는 허용 목록에 없으므로 실제로 제거됩니다. 다만 **`_` (언더스코어)는 허용 목록에 포함**되어 있어 사용자가 `_` 문자를 입력하면 SQL LIKE에서 단일 문자 와일드카드로 동작합니다.
  ```typescript
  // 라인 69: t에 '_'가 포함되면 LIKE 와일드카드로 해석됨
  builder = builder.or(`title.ilike.%${t}%,excerpt.ilike.%${t}%`)
  ```
  - 실제 영향: `_`를 포함한 검색어가 의도하지 않은 매칭을 일으킬 수 있습니다. 보안적으로 치명적이지는 않으나 (데이터 유출/변조 불가) 검색 결과의 정확성에 영향을 줍니다.
  - 권장 조치: `sanitize()` 함수에서 `_`를 LIKE 이스케이프하거나, 별도로 `t.replace(/_/g, '\\_')`를 적용하여 리터럴 매칭이 되도록 처리하십시오.

- **[app/rss.xml/route.ts:29,33] CDATA 종료 시퀀스 미이스케이프**
  - 설명: RSS 피드에서 `<title>`과 `<description>`에 CDATA 섹션을 사용하고 있으나, 게시글 제목이나 excerpt에 `]]>` 문자열이 포함될 경우 CDATA 섹션이 조기 종료되어 XML 파싱 에러가 발생합니다. `escapeXml()` 함수(라인 7-14)가 정의되어 있으나 CDATA 내부에서는 사용되지 않고 있습니다.
  ```typescript
  // 라인 29: p.title에 "]]>"가 포함되면 XML 깨짐
  <title><![CDATA[${p.title}]]></title>
  ```
  - 권장 조치: CDATA 대신 `escapeXml()`을 사용하거나, CDATA 내부에서 `]]>`를 `]]]]><![CDATA[>`로 분할하는 처리를 추가하십시오.

- **[app/posts/[slug]/page.tsx:298-299] 이전/다음 포스트 slug 미인코딩**
  - 설명: 이전/다음 포스트 네비게이션 링크에서 slug를 인코딩하지 않고 직접 사용하고 있습니다.
  ```typescript
  // 라인 298
  href={`/posts/${prevPost.slug}`}
  // 라인 311
  href={`/posts/${nextPost.slug}`}
  ```
  - 한글이나 특수문자가 포함된 slug의 경우 URL이 깨질 수 있습니다. 같은 파일의 라인 53에서는 `encodeURI(slug)`를 사용하고 있어 일관성이 없습니다.
  - 권장 조치: `encodeURIComponent(prevPost.slug)` 또는 `encodeURI(prevPost.slug)`로 감싸주십시오.

- **[전역] not-found.tsx / error.tsx 경계 파일 부재**
  - 설명: 프로젝트 전체에 `not-found.tsx`와 `error.tsx` 파일이 없습니다. `app/posts/[slug]/page.tsx:115`와 `app/categories/[...slug]/page.tsx:46`에서 `notFound()`를 호출하지만, 커스텀 404 페이지가 없으므로 Next.js 기본 404 페이지가 표시됩니다. 또한 데이터 페칭 중 예기치 못한 에러 발생 시 전체 앱이 흰 화면(white screen)으로 표시될 수 있습니다.
  - 권장 조치:
    - `app/not-found.tsx`를 추가하여 블로그 디자인과 일치하는 커스텀 404 페이지를 제공하십시오.
    - `app/error.tsx`를 추가하여 에러 복구 UI를 제공하십시오 (`'use client'` 필수).
    - `app/posts/[slug]/not-found.tsx`도 별도로 추가하면 더 세밀한 UX를 제공할 수 있습니다.

### 🟡 Medium

- **[app/posts/[slug]/page.tsx:53,155 / app/sitemap.ts:33 / app/rss.xml/route.ts:27] `encodeURI` vs `encodeURIComponent` 혼용**
  - 설명: slug 인코딩에 `encodeURI()`를 사용하고 있으나, `encodeURI()`는 `#`, `?`, `&` 등 URL 예약 문자를 인코딩하지 않습니다. slug에 이러한 문자가 포함되면 URL이 의도치 않게 분리될 수 있습니다.
  ```typescript
  // slug가 "c#-tutorial" 이면:
  encodeURI("c#-tutorial")     // → "c#-tutorial" (# 미인코딩, fragment로 해석)
  encodeURIComponent("c#-tutorial") // → "c%23-tutorial" (안전)
  ```
  - 권장 조치: slug 인코딩에는 일관되게 `encodeURIComponent()`를 사용하십시오. 카테고리 경로에서는 이미 `encodeURIComponent`를 올바르게 사용하고 있으므로, slug에도 동일하게 적용하면 됩니다.

- **[app/posts/[slug]/page.tsx:117-119] 비공개 글 조회수 트래킹 조건 불완전**
  - 설명:
  ```typescript
  if (!isAdmin && post.visibility === 'public') {
    await trackView(post.id)
  }
  ```
  - `isAdmin`이 `true`인 경우에도 `postQuery`에서 visibility 필터가 제거되어 비공개/초안 글에 접근할 수 있습니다 (라인 108). 이 자체는 의도된 동작이나, `trackView`를 `await`로 호출하고 있어 조회수 기록 실패 시 전체 페이지 렌더링이 실패할 수 있습니다.
  - 권장 조치: `trackView`를 fire-and-forget으로 호출하거나 (`void trackView(post.id)`), try-catch로 감싸서 조회수 기록 실패가 페이지 렌더링에 영향을 주지 않도록 하십시오.

- **[app/posts/[slug]/opengraph-image.tsx:14-15] `.single()` 사용 시 에러 미처리**
  - 설명: OG 이미지 생성에서 `.single()`을 사용하고 있으나 에러를 처리하지 않습니다. `.single()`은 결과가 0건이면 에러를 throw하며, `.maybeSingle()`과 다릅니다. 같은 파일의 부모 페이지(`app/posts/[slug]/page.tsx:49`)에서는 올바르게 `.maybeSingle()`을 사용하고 있습니다.
  ```typescript
  // 라인 14-15: 존재하지 않는 slug로 접근 시 에러 throw
  .single()
  ```
  - 권장 조치: `.single()`을 `.maybeSingle()`로 변경하십시오. 이미 라인 17에서 `post?.title ?? 'ShyLog'` fallback이 구현되어 있으므로 null 처리는 준비되어 있습니다.

- **[app/posts/[slug]/page.tsx:85,41 / app/categories/[...slug]/page.tsx:20,43 / app/tags/[tag]/page.tsx:9,30] Next.js params 타입 비동기 접근**
  - 설명: Next.js 14.2에서 `params`는 동기적으로 접근 가능하지만, Next.js 15부터는 `params`가 `Promise`로 변경됩니다. 현재 `next: "14.2.35"`이므로 당장 문제는 없으나, 업그레이드 시 모든 `params.slug`, `params.tag` 접근이 깨집니다.
  - 권장 조치: Next.js 15 마이그레이션을 대비하여 `const { slug } = await params` 패턴 적용을 고려하십시오. 당장 필요하지는 않습니다.

- **[app/tags/[tag]/page.tsx] 페이지네이션 미구현**
  - 설명: 태그 페이지에서 `.limit()` 없이 모든 게시글을 한 번에 불러오고 있습니다 (라인 34-43). 특정 태그에 수백 개의 글이 있으면 응답 시간이 길어지고 UI 성능이 저하될 수 있습니다. 반면 홈페이지와 카테고리 페이지에서는 `InfinitePostList`로 페이지네이션이 구현되어 있습니다.
  - 권장 조치: 카테고리 페이지와 동일한 `FEED_PAGE_SIZE + 1` 패턴 + `InfinitePostList` 컴포넌트를 적용하십시오.

- **[app/search/page.tsx] 카테고리 정보 미포함**
  - 설명: 검색 결과의 `PostCard`에서 `category` prop이 전달되지 않습니다 (라인 96-107). 다른 페이지(홈, 카테고리, 태그)에서는 카테고리 정보를 함께 표시하고 있어 UI 일관성이 부족합니다.
  - 권장 조치: 검색 쿼리에 `category_id`를 포함하고, `fetchCategoryTree()`를 병렬 호출하여 카테고리 정보를 매핑하십시오.

### 🟢 Low

- **[app/layout.tsx:84] `suppressHydrationWarning` 사용**
  - 설명: `<html>` 태그에 `suppressHydrationWarning`이 적용되어 있습니다. 이는 다크모드 스크립트(라인 86-97)로 인한 클래스 불일치를 억제하기 위한 것으로, 일반적인 패턴이며 적절합니다. 단, `suppressHydrationWarning`은 해당 요소에만 적용되고 자식에는 전파되지 않으므로 현재 사용이 올바릅니다.
  - 권장 조치: 없음 (현재 사용이 적절합니다).

- **[app/sitemap.ts:34,44 / app/rss.xml/route.ts:41] `new Date()` fallback**
  - 설명: `updated_at`이 없는 경우 `new Date()`를 fallback으로 사용하고 있습니다. 이는 서버 사이드에서만 실행되므로 하이드레이션 문제는 없으나, 빌드 시마다 날짜가 달라져 불필요한 사이트맵 변경이 발생할 수 있습니다.
  - 권장 조치: 고정 날짜(예: 사이트 론칭일) 또는 `created_at`을 fallback으로 사용하는 것을 고려하십시오.

- **[app/posts/[slug]/page.tsx:279] 커버 이미지 alt 텍스트 누락**
  - 설명: `<Image>` 컴포넌트의 `alt` 속성이 빈 문자열(`""`)로 설정되어 있습니다. 장식용 이미지라면 적절하나, 커버 이미지는 게시글의 주요 시각 요소이므로 의미 있는 대체 텍스트가 있으면 접근성이 향상됩니다.
  - 권장 조치: `alt={post.title}` 또는 `alt={\`${post.title} 커버 이미지\`}`로 변경을 고려하십시오.

- **[app/page.tsx:10 / app/sitemap.ts:8 / app/rss.xml/route.ts:17] Supabase 클라이언트 에러 미처리 패턴**
  - 설명: `app/page.tsx`에서는 `error`를 체크하여 사용자에게 에러 메시지를 보여주고 있으나(라인 76-79), `sitemap.ts`와 `rss.xml/route.ts`에서는 에러를 무시하고 빈 배열로 fallback하고 있습니다. Supabase 연결 실패 시 빈 사이트맵/RSS가 서빙되어 SEO에 부정적 영향을 줄 수 있습니다.
  - 권장 조치: 에러 시 HTTP 500 응답을 반환하거나, 최소한 에러를 로깅하십시오.

- **[app/posts/[slug]/page.tsx:85-100] 순차적 Supabase 쿼리**
  - 설명: `getUser()` → `profiles` 조회 → `posts` 조회가 순차적으로 실행됩니다. `getUser()`와 `fetchCategoryTree()`는 `Promise.all`로 병렬 처리되고 있으나(라인 110), 사용자 인증 확인(라인 91-99)이 선행되어야 하는 구조적 제약이 있습니다.
  - 권장 조치: 현재 구조가 논리적으로 올바르지만, `isAdmin` 확인과 `fetchCategoryTree()`를 `Promise.all`로 묶어 지연 시간을 줄일 수 있습니다. 전체 시퀀스를 `const [user, tree] = await Promise.all([supabase.auth.getUser(), fetchCategoryTree()])` 후 admin 확인 → post 조회로 재구성하면 하나의 RTT를 절약할 수 있습니다.

### ℹ️ Info / 개선 제안

- **검색 페이지 카테고리/태그 `loading.tsx` 부재**: `app/search/`, `app/categories/[...slug]/`, `app/tags/[tag]/` 경로에 `loading.tsx`가 없습니다. 데이터 페칭이 느릴 경우 사용자에게 로딩 피드백이 제공되지 않습니다. 이 경로들에 `loading.tsx`를 추가하면 체감 성능이 개선됩니다.

- **Sitemap에 태그 페이지 미포함**: `app/sitemap.ts`에서 게시글과 카테고리 페이지는 포함하고 있으나 태그 페이지(`/tags/[tag]`)는 포함되어 있지 않습니다. 태그별 페이지도 SEO 가치가 있으므로 사이트맵에 추가를 고려하십시오.

- **Manifest 다크모드 미지원**: `app/manifest.ts`에서 `background_color`와 `theme_color`가 모두 `#ffffff`로 하드코딩되어 있습니다 (라인 11-12). 다크모드를 지원하는 블로그이므로, 향후 manifest의 dark theme 지원이 표준화되면 대응을 고려할 수 있습니다.

- **`robots.ts`에서 `site.url` 대신 `process.env` 직접 참조**: `app/robots.ts:4`에서 `process.env.NEXT_PUBLIC_SITE_URL`을 직접 읽고 있으나, 다른 파일들은 `site.url`을 사용합니다. 일관성을 위해 `site.url`을 사용하는 것이 좋습니다.

## 좋은 점 (긍정 관찰)

- **구조화된 데이터 (JSON-LD)**: 홈페이지에 `WebSite` 스키마, 게시글에 `Article` + `BreadcrumbList` 스키마, 카테고리에 `BreadcrumbList` 스키마를 적절히 적용하고 있어 SEO 품질이 우수합니다.
- **입력 새니타이제이션**: 검색 페이지의 `sanitize()` 함수가 PostgREST 문법 문자를 체계적으로 차단하고, 입력 길이 제한(100자)과 검색어 수 제한(5개)을 적용하고 있습니다.
- **카테고리 트리 캐싱**: `fetchCategoryTree()`에 `React.cache()`를 적용하여 같은 요청 내 중복 호출을 방지하고 있습니다.
- **점진적 데이터 로딩**: 홈페이지와 카테고리 페이지에서 `FEED_PAGE_SIZE + 1` 패턴으로 "더 있는지" 확인 후 무한 스크롤을 적절히 구현하고 있습니다.
- **Server Component 활용**: 모든 페이지가 Server Component로 구현되어 있어 클라이언트 번들에 불필요한 코드가 포함되지 않습니다. `'use client'`는 필요한 인터랙티브 컴포넌트(Comments, ShareButton 등)에만 적용되어 있습니다.
- **해시태그 검색 → 태그 페이지 리다이렉트**: `#tag` 검색 시 태그 페이지로 리다이렉트하여 single source of truth를 유지하는 설계가 좋습니다.
- **Breadcrumb 네비게이션**: 게시글과 카테고리 페이지에서 aria-label이 적용된 시맨틱 breadcrumb을 일관되게 제공하고 있습니다.
- **메타데이터 완성도**: 모든 동적 라우트에서 `generateMetadata()`를 통해 OpenGraph, Twitter Card, canonical URL을 빠짐없이 생성하고 있습니다.

## 후속 액션 권고
- [ ] `app/not-found.tsx`와 `app/error.tsx` 경계 파일 추가 (HIGH)
- [ ] RSS CDATA `]]>` 이스케이프 처리 (HIGH)
- [ ] 이전/다음 포스트 링크의 slug 인코딩 추가 (HIGH)
- [ ] `app/posts/[slug]/opengraph-image.tsx`에서 `.single()` → `.maybeSingle()` 변경 (MEDIUM)
- [ ] slug 인코딩을 `encodeURI` → `encodeURIComponent`로 통일 (MEDIUM)
- [ ] `trackView()` 호출을 fire-and-forget 또는 try-catch로 변경 (MEDIUM)
- [ ] 태그 페이지에 페이지네이션 추가 (MEDIUM)
- [ ] 검색 결과에 카테고리 정보 추가 (MEDIUM)
- [ ] `robots.ts`에서 `site.url` 사용으로 통일 (LOW)
- [ ] 커버 이미지 alt 텍스트 추가 (LOW)
