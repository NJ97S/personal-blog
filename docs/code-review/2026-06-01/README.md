# 전체 코드리뷰 종합 보고서

> 검토일: **2026-06-01** · 대상 브랜치: `main` (HEAD `d046717`)
> 검토 방식: 5개 도메인 병렬 리뷰 → 본 문서에서 종합
> 검토자: `code-reviewer × 4` + `security-reviewer × 1` (오케스트레이터: OMC team)

## 1. 검토 범위

| 도메인 | 보고서 | 검토 파일 수 |
|:---|:---|:---|
| App Router 페이지·레이아웃 | [`01-app-routes.md`](./01-app-routes.md) | 14 |
| UI 컴포넌트 | [`02-components.md`](./02-components.md) | 32 (28 .tsx + 4 .ts) |
| 인프라 / 서버액션 / API / 미들웨어 | [`03-infrastructure.md`](./03-infrastructure.md) | 30+ |
| 보안 횡단 | [`04-security.md`](./04-security.md) | 전체 70+ |
| 성능 / Next.js 베스트프랙티스 | [`05-performance.md`](./05-performance.md) | 전체 |

- 총 소스 규모: 74 TS/TSX 파일 / **약 5,920 LOC** (`app`, `components`, `lib`, `middleware.ts` 기준)
- 스택: Next.js 14.2.35 (App Router) · React 18.3 · Supabase SSR · Upstash Ratelimit · TypeScript 5

## 2. 심각도 분포 (도메인별)

| 심각도 | App | Components | Infra | Security | Perf | 합계 |
|:---|---:|---:|---:|---:|---:|---:|
| 🔴 Critical | 0 | 1 | 0 | 0 | 1 | **2** |
| 🟠 High | 4 | 4 | 3 | 1 | 4 | **16** |
| 🟡 Medium | 5 | 6 | 6 | 4 | (다수) | **21+** |
| 🟢 Low | 4 | 5 | 3 | 5 | (다수) | **17+** |
| ℹ️ Info | (다수) | 4 | 3 | – | (다수) | – |

> 도메인 간 동일 이슈는 본 종합 보고서 §3·§4에서 1건으로 합산했습니다.

## 3. 즉시 조치가 필요한 핵심 이슈 (Critical & High)

심각도/영향/투입 비용 기준으로 **상위 12건**을 우선순위 순으로 정리합니다.

### 🔴 [P0-1] JsonLd XSS — `</script>` 이스케이프 누락
- **파일**: `components/JsonLd.tsx:5`
- **요약**: `dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}`. JSON 문자열 내부의 `</script>`가 그대로 출력되어 글 제목·발췌가 데이터 소스라면 스크립트 주입 가능.
- **조치**: `JSON.stringify(data).replace(/</g, '\\u003c')`
- **출처**: 02-components(Critical), 04-security(SEC-L-1)
- **노트**: 보안 리뷰어는 Next.js 자동 이스케이프를 근거로 LOW로 평가했으나, JSON-LD `<script type="application/ld+json">`에는 자동 이스케이프가 적용되지 않으므로 **CRITICAL로 통일**해 즉시 수정 권장합니다.

### 🔴 [P0-2] 커스텀 폰트 `memoment-kkukkukk.woff2` 2.25MB 사전 로드
- **파일**: `app/fonts/memoment-kkukkukk.woff2`, `app/layout.tsx:8-16`
- **요약**: 모든 페이지에서 2.25MB 폰트를 `preload`하여 LCP를 1–6초 악화시킵니다. 모바일 3G에서는 가장 큰 성능 부채입니다.
- **조치**: `pyftsubset`/`glyphhanger`로 한글 KS X 1001 + Latin Basic만 서브셋(~400KB). `font-display: swap` 유지, 영문은 시스템 폰트로 분리.
- **출처**: 05-performance(Critical)

### 🟠 [P1-1] 검색 PostgREST `.or()` 필터 LIKE 메타문자 미이스케이프
- **파일**: `app/search/page.tsx:69`
- **요약**: `sanitize()`가 PostgREST 위험문자 대부분을 제거하지만 `%`, `_`, `\` 이스케이프가 없습니다. 산티타이저 우회가 발견되면 비공개/초안 글 열거 가능.
- **조치**: 보간 직전에 `t.replace(/[%_\\]/g, '\\$&')` 또는 Supabase `textSearch()` 전환.
- **출처**: 04-security(SEC-H-1)

### 🟠 [P1-2] `next.config.mjs` 이미지 `remotePatterns hostname: '**'` (SSRF/대역폭 남용)
- **파일**: `next.config.mjs:5`
- **요약**: Next.js 이미지 옵티마이저가 임의 HTTPS URL을 프록시. 관리자(또는 cover_image 입력 경로)가 내부 IP를 가리키면 서버가 fetch.
- **조치**: 실제 사용 호스트만 명시 (`*.supabase.co` 등).
- **출처**: 03-infrastructure(H-1), 04-security(SEC-M-1)

### 🟠 [P1-3] Content-Security-Policy 헤더 부재
- **파일**: `next.config.mjs`
- **요약**: `rehype-sanitize` 우회나 dependency 사고가 한 번 발생하면 막을 길이 없습니다.
- **조치**: 베이스라인 CSP 추가.
  ```js
  { key: 'Content-Security-Policy', value:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';" }
  ```
- **출처**: 03-infrastructure(H-2), 04-security(SEC-M-2)

### 🟠 [P1-4] `publishPost` / `unpublishPost` UUID 미검증
- **파일**: `app/actions/posts.ts:237-247, 249-259`
- **요약**: 같은 파일의 다른 액션에는 `UUID_RE.test(id)` 검증이 있으나 두 액션만 누락.
- **조치**: 동일 패턴 추가.
  ```ts
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }
  ```
- **출처**: 03-infrastructure(H-3)

### 🟠 [P1-5] 홈 페이지 캐싱·`revalidate` 부재
- **파일**: `app/page.tsx`
- **요약**: 매 요청마다 Supabase 2회 호출. `revalidate: 60` 적용으로 TTFB 100–300ms 감소 기대.
- **조치**: 세그먼트 `export const revalidate = 60` 또는 `unstable_cache` 적용.
- **출처**: 05-performance(High)

### 🟠 [P1-6] 글 상세 페이지 `force-dynamic` + 4단계 쿼리 워터폴
- **파일**: `app/posts/[slug]/page.tsx:17, 41-146`
- **요약**: `generateMetadata`와 `PostPage`가 동일 slug 조회를 중복 수행. 인증 체크가 순차 의존을 만들고 있습니다.
- **조치**: React `cache()`로 slug 조회 dedup, 가능한 경우 ISR (`revalidate: 300` 등) 전환.
- **출처**: 05-performance(High)

### 🟠 [P1-7] `rehype-highlight`가 전체(약 190개) 언어를 번들에 포함
- **파일**: `components/MarkdownView.tsx:6`
- **요약**: 약 180KB gzip을 클라이언트에 전달. 사용 언어만 import하면 ~150KB 감축 가능.
- **조치**:
  ```ts
  import rehypeHighlight from 'rehype-highlight'
  import ts from 'highlight.js/lib/languages/typescript'
  // ...
  rehypePlugins: [[rehypeHighlight, { languages: { ts, js, json, bash, py, ... } }]]
  ```
- **출처**: 05-performance(High)

### 🟠 [P1-8] 태그 페이지 `.limit()` 미설정
- **파일**: `app/tags/[tag]/page.tsx:34-43`
- **요약**: 태그에 글이 많아질수록 무한정 fetch.
- **조치**: 페이지네이션 도입 또는 합리적 `.limit(50)` + 더 보기.
- **출처**: 05-performance(High), 01-app-routes(MEDIUM)

### 🟠 [P1-9] RSS CDATA 종료 시퀀스 미처리
- **파일**: `app/rss.xml/route.ts:28-34`
- **요약**: 제목·발췌의 `]]>`가 CDATA를 종료. XML 파싱 깨짐 및 일부 피드 리더에서 XML 주입 가능.
- **조치**: `escapeCdata()` 적용 또는 CDATA 대신 `escapeXml()` 사용으로 통일.
- **출처**: 01-app-routes(High), 04-security(SEC-M-3)

### 🟠 [P1-10] 모달·드로어 포커스 트랩 부재 (PublishModal, CategoryDrawer)
- **파일**: `components/PublishModal.tsx:86-101`, `components/CategoryDrawer.tsx:33-68`
- **요약**: Tab으로 배경 요소에 도달 가능 (WCAG 2.4.3 위반). 열림 시 첫 포커스, 닫힘 시 트리거 복원 없음.
- **조치**: `focus-trap-react` 또는 `inert` + `autoFocus` 패턴.
- **출처**: 02-components(High × 2)

### 🟠 [P1-11] 이전/다음 글 slug URL 미인코딩
- **파일**: `app/posts/[slug]/page.tsx:298, 311`
- **요약**: 한글·특수문자 slug에서 라우팅 깨짐.
- **조치**: `href={\`/posts/${encodeURIComponent(prevPost.slug)}\`}`
- **출처**: 01-app-routes(High)

### 🟠 [P1-12] `not-found.tsx` / `error.tsx` 부재
- **파일**: 전역
- **요약**: Next.js 기본 화면 사용. 데이터 fetch 실패 시 흰 화면 가능.
- **조치**: 루트 `app/not-found.tsx`, `app/error.tsx` 추가. 핵심 라우트별 세그먼트 에러 바운더리도 권장.
- **출처**: 01-app-routes(High)

## 4. 횡단 테마 (도메인 간 공통 신호)

같은 뿌리를 가진 이슈들은 한 번에 처리하면 효과가 큽니다.

1. **헤더 보안 강화 한 묶음** — CSP, HSTS, (옵션) `Permissions-Policy`를 함께 추가. (인프라 H-2/M-6, 보안 SEC-M-2)
2. **외부 리소스 신뢰 경계** — `images.remotePatterns` 화이트리스트 + CSP `img-src` 제한 + Telegram URL escape. (인프라 H-1/M-1, 보안 SEC-M-1)
3. **마크다운/HTML 출력 안전성** — JsonLd `</script>` 이스케이프, RSS CDATA 이스케이프, `rehypeSourceLine`이 sanitizer 이후 실행되는 설계는 유지. (컴포넌트 Critical, 앱 High, 보안 SEC-M-3)
4. **권한 게이트 이중화** — 미들웨어가 `getUser()` 존재만 보고 `is_admin`을 검증하지 않음. 서버 컴포넌트에서 `requireAdmin()`로 보조. (인프라 M-5)
5. **데이터 페칭 캐싱 일관성 부재** — 일부 페이지는 `force-dynamic`이고 홈은 캐싱이 아예 없음. 페이지별 캐싱 정책(`revalidate`/`unstable_cache`/세그먼트 `dynamic`)을 명문화. (성능 High, 앱 라우트 Medium)
6. **클라이언트 번들 절감 기회** — `rehype-highlight` 언어 서브셋, `@uiw/react-md-editor`의 공개 페이지 제외, 커스텀 폰트 서브셋. (성능 Critical/High)
7. **React 18.3 → 19 마이그레이션 부채** — `useFormState` deprecated. `useActionState` 전환 계획. (컴포넌트 M)

## 5. 좋은 점 (긍정 관찰)

이번 검토에서 확인된 **잘 구현된 부분**입니다. 회귀 방지를 위해 보존 가치가 큽니다.

- **Supabase 보안 모범 사례** — `getUser()` 강제, Service Role Key 격리, SECURITY DEFINER RPC + `search_path` 고정, `public_comments` 뷰로 민감 컬럼 격리.
- **댓글 시스템 설계** — bcrypt, edit token, soft delete, Upstash sliding-window rate limit, 컨트롤 문자 제거. 비회원 댓글 시스템 치고 보안 수준이 높습니다.
- **CSRF** — 모든 mutation이 Server Action. GET 변형 없음.
- **`useMarkdownScrollSync.ts`** — off-screen mirror + line-map + monotonic 보간으로 CRLF·코드블록 케이스를 정확히 처리. `destroy()`에서 리소스를 빠짐없이 정리.
- **`'use client'` 경계** — 32개 컴포넌트 중 17개 서버 / 15개 클라이언트로 적절히 분리.
- **접근성 기본** — `aria-label/hidden`, `role="status"`, `aria-live`, `sr-only` 일관 적용. ThemeToggle의 `role="switch"` + `aria-checked`.
- **rehype-sanitize 위치** — `rehype-raw`·`rehype-highlight` 이후 sanitizer가 실행되며 `rehypeSourceLine`은 sanitizer 다음.
- **환경변수 분리** — 클라이언트 노출 변수는 `NEXT_PUBLIC_*` 4종에 한정.
- **미들웨어 매처** — `/admin/:path*`만 매칭하여 공개 페이지에 불필요한 cookie 갱신을 일으키지 않음.
- **cron auth** — `Bearer ${CRON_SECRET}` 검증 + `runtime: nodejs`.

## 6. 권장 처리 로드맵

### Sprint A (이번 주, 변경량 작음·임팩트 큼)
- [ ] **P0-1** JsonLd `</script>` 이스케이프
- [ ] **P1-4** publishPost/unpublishPost UUID 검증
- [ ] **P1-11** 이전/다음 slug 인코딩
- [ ] **P1-2** `remotePatterns` 호스트 화이트리스트
- [ ] **P1-9** RSS CDATA 이스케이프
- [ ] **P1-3** CSP 베이스라인 + HSTS 추가
- [ ] `lib/telegram.ts` `escapeHtml`에 따옴표 추가 (인프라 M-1)

### Sprint B (다음 2주, 사용자 체감 효과 큼)
- [ ] **P0-2** kkukkukk 폰트 서브셋 (예상 2.25MB → ~400KB)
- [ ] **P1-7** `rehype-highlight` 언어 서브셋 (~150KB gzip 절감)
- [ ] **P1-5** 홈 `revalidate: 60`
- [ ] **P1-6** post 상세 페이지 React `cache()` dedup + ISR 도입
- [ ] **P1-1** 검색 LIKE 메타문자 이스케이프 (또는 `textSearch()` 전환)
- [ ] **P1-10** 모달/드로어 포커스 트랩
- [ ] **P1-12** `not-found.tsx`, `error.tsx` 추가

### Sprint C (다음 달, 구조 개선)
- [ ] 미들웨어 또는 admin 페이지에서 `is_admin` 검증 추가 (인프라 M-5)
- [ ] `reorderCategory` RPC 트랜잭션화 (인프라 M-2)
- [ ] cron `maxDuration` 명시 + 결과 `.limit()` (인프라 M-4)
- [ ] Telegram 전송 fire-and-forget (`waitUntil`) (인프라 M-3)
- [ ] `InfinitePostList`의 `seenIdsRef` props-변경 동기화 (컴포넌트 M)
- [ ] `CommentForm` `useFormState` → `useActionState` 마이그레이션 계획 수립
- [ ] 댓글 편집 토큰 만료/회전 정책 (보안 SEC-M-4)
- [ ] `eslint-config-next` 메이저 업그레이드로 glob CVE 해소
- [ ] 태그 페이지 페이지네이션 (`P1-8` 완료 후 운영 데이터 보고 결정)

### 회귀 방지 권고
- `next.config.mjs` 헤더 / `remotePatterns`에 대한 lint 또는 단위 테스트.
- Server Action 신규 추가 시 UUID·길이 검증 체크리스트.
- `rehype-sanitize` 스키마 변경 시 PR 템플릿에 보안 영향 확인 항목 추가.

## 7. 종합 판정

> **REQUEST CHANGES — Sprint A 항목 우선 처리 후 재검토 권장**

전체적으로 **인증·권한·서버 액션 설계 품질이 매우 좋고**, 댓글 시스템과 마크다운 렌더 파이프라인의 보안·정확성도 모범적입니다. 다만 **JsonLd XSS 1건**, **헤더/리모트 패턴 보안 보강 3건**, **검색 인젝션 가능성 1건**, **퍼포먼스 핵심 부채(폰트·하이라이트·캐싱) 4건** 은 Sprint A·B 안에서 정리하는 것이 안전합니다.

---

### 부록 — 도메인별 상세 보고서 링크
- [01 · App Router 페이지·레이아웃](./01-app-routes.md)
- [02 · UI 컴포넌트](./02-components.md)
- [03 · 인프라 / 서버액션 / API / 미들웨어](./03-infrastructure.md)
- [04 · 보안 횡단 리뷰](./04-security.md)
- [05 · 성능 / Next.js 베스트프랙티스](./05-performance.md)
