# 보안 횡단 리뷰

> 검토자: `security-reviewer` · 검토일: 2026-06-01 · 범위: 전체 저장소 70+ 파일 / Next.js 14.2.35 + Supabase

## 요약
- 위협 모델 요약: 공개 블로그 + 비회원 댓글 + Supabase SSR 어드민. 외부 공격면은 공개 페이지 입력(검색·댓글)과 관리자 페이지가 주를 이루며, 어드민 인증·서비스 키 경계는 잘 설계되어 있습니다.
- 위험 수준: **MEDIUM** — Critical 0, High 1, Medium 4, Low/Info 5.
- 핵심 발견 (5줄)
  1. `app/search/page.tsx:69` — PostgREST `.or()` 필터 문자열 보간. 산티타이저가 대부분의 위험 문자를 제거하지만 LIKE 메타문자(`%`, `_`, `\`) 이스케이프가 빠져 있어 방어선이 얇습니다.
  2. `next.config.mjs:5` — `remotePatterns hostname: '**'`로 인한 잠재적 SSRF/리소스 남용.
  3. `next.config.mjs` — CSP 헤더 부재로 XSS 발견 시 방어선이 없습니다.
  4. `app/rss.xml/route.ts:28-34` — CDATA 내부 `]]>` 처리가 없어 RSS XML 깨짐/주입.
  5. `lib/comment-tokens.ts` — 댓글 편집 토큰이 만료 없이 localStorage에 영구 저장.

---

## 발견사항

### 🔴 Critical
없습니다.

### 🟠 High

#### [SEC-H-1] PostgREST 필터 인젝션 가능성 — 검색
- **파일**: `app/search/page.tsx:69`
- **카테고리**: A03 Injection
- **상세**: 검색어가 `sanitize()`(line 14-19)를 통과한 뒤 `.or()` 필터 문자열에 직접 보간됩니다.
  ```ts
  builder = builder.or(`title.ilike.%${t}%,excerpt.ilike.%${t}%`)
  ```
  `sanitize`는 `.`, `,`, `(`, `)`, `%` 등 PostgREST 위험 문자는 제거하지만 LIKE 메타문자 백슬래시(`\`)와 `%`, `_`(전자는 제거되더라도 후자 두 종류의 이스케이프는 별개)를 정식으로 처리하지 않습니다. 산티타이저 정규식의 작은 변경이나 유니코드 정규화 우회가 발생하면 필터 문법 인젝션으로 비공개/초안 글 제목·발췌 열거나 의도치 않은 쿼리 동작을 유발할 수 있습니다.
- **권장 조치**: LIKE 메타문자를 명시적 이스케이프하거나 Supabase `textSearch()`로 전환.
  ```ts
  const escaped = t.replace(/[%_\\]/g, '\\$&')
  builder = builder.or(`title.ilike.%${escaped}%,excerpt.ilike.%${escaped}%`)
  ```

### 🟡 Medium

#### [SEC-M-1] 이미지 `remotePatterns` 와일드카드 → SSRF / 대역폭 남용
- **파일**: `next.config.mjs:5`
- **카테고리**: A05 Security Misconfiguration
- **상세**: `hostname: '**'`로 Next.js 이미지 옵티마이저가 임의 HTTPS URL을 프록시합니다. 커버 이미지 URL을 설정할 수 있는 관리자가 내부 서비스 IP를 가리키도록 만들면 서버가 해당 URL을 fetch합니다. 외부 큰 이미지로 대역폭/CPU 남용도 가능합니다.
- **권장**: 실제 사용하는 호스트만 허용.

#### [SEC-M-2] CSP 미설정
- **파일**: `next.config.mjs:9-18`
- **상세**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`는 좋으나 `Content-Security-Policy`가 없습니다. `rehype-sanitize` 우회가 한 번이라도 발견되면 임의 외부 스크립트 로드/데이터 유출이 막을 길이 없습니다.
- **권장**: 베이스라인 CSP 도입.
  ```js
  { key: 'Content-Security-Policy', value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; ') }
  ```

#### [SEC-M-3] RSS CDATA 종료 시퀀스 미처리
- **파일**: `app/rss.xml/route.ts:28-34`
- **상세**: `escapeXml()`(line 7-14)이 있으나 CDATA 블록 안의 제목/발췌에는 적용되지 않습니다. 관리자가 `]]>`를 포함한 글을 작성하면 CDATA가 종료되어 XML이 깨지며 일부 피드 리더에서 임의 XML 노드 주입이 가능할 수 있습니다.
- **권장**: CDATA 종료 시퀀스를 분할.
  ```ts
  function escapeCdata(s: string) { return s.replace(/]]>/g, ']]]]><![CDATA[>') }
  ```
  또는 CDATA 대신 `escapeXml()`로 통일.

#### [SEC-M-4] 댓글 편집 토큰 만료 없음
- **파일**: `lib/comment-tokens.ts:1-40`
- **상세**: 32바이트 hex 토큰이 localStorage에 영구 저장되어 공용 컴퓨터에서 다음 사용자가 이전 비회원 댓글을 편집/삭제할 수 있습니다.
- **권장**: 토큰에 `createdAt` 함께 저장 후 N일 후 폐기. DB RPC에서도 토큰 사용 시간창 제한.

### 🟢 Low / Info

- **[SEC-L-1] `JsonLd.tsx:5` `dangerouslySetInnerHTML`** — `JSON.stringify`가 `</script>`를 이스케이프하지 않습니다. (컴포넌트 리뷰의 CRITICAL과 동일 이슈. 보안 관점에서도 즉시 수정 권장.)
  ```ts
  __html: JSON.stringify(data).replace(/</g, '\\u003c')
  ```
- **[SEC-L-2] `app/layout.tsx:87-96` 인라인 테마 스크립트** — 하드코딩 문자열, 사용자 입력 흐름 없음 → 수용 가능. CSP에 `'unsafe-inline'`이 필요하다는 점만 유의.
- **[SEC-L-3] 관리자 로그인 브루트포스 레이트 리밋 부재** — `signInWithPassword`만 호출. Supabase GoTrue 기본 30/h가 있으나 1인 관리자 블로그라 위험은 낮습니다.
- **[SEC-L-4] Cron Bearer 비교가 타이밍-세이프 아님** (`app/api/cron/digest/route.ts:10`) — 시크릿이 64자 hex라 실제 위험은 무시할 만하지만 `timingSafeEqual` 적용을 권장.
- **[SEC-L-5] `npm audit` glob 고심각** — `eslint-config-next` → `glob@10.x` 경로. 빌드 시점에만 사용되는 dev 의존성. `eslint-config-next` 메이저 업그레이드로 해소.

### ✅ 잘 된 점
- **`getUser()` 사용** — 서버 검증된 JWT. `getSession()` 미사용.
- **댓글 RPC** — bcrypt 비밀번호 해싱과 edit token을 SECURITY DEFINER RPC로 강제.
- **CSRF** — 모든 mutation이 Next.js Server Action(POST + origin check). GET 변형 없음.
- **rehype-sanitize** — `rehype-raw`+`rehype-highlight` 이후 sanitizer 실행. 커스텀 스키마는 heading id와 code/span/pre className만 허용. 댓글 본문은 JSX 텍스트로 렌더.
- **환경변수 분리** — 클라이언트 노출은 `NEXT_PUBLIC_*` 4종(URL/anon key/Naver/site URL). 서비스 키·Telegram 봇·CRON_SECRET·Upstash는 서버 전용.
- **Rate limit** — 댓글 생성/수정 5/10분, sliding window per IP.
- **Open redirect** — 모든 redirect가 고정 경로 또는 `encodeURIComponent` 적용 후 고정 접두.
- **SSRF** — Telegram 외 외부 fetch 없음(이미지 옵티마이저 케이스만 SEC-M-1로 분리).

---

## 영역별 평가

- **인증/세션**: GOOD — 미들웨어가 매 요청마다 `getUser()`로 검증, admin 라우트 게이트 정상.
- **권한**: GOOD — 모든 mutation이 `requireAdmin()` 통과. 댓글은 token/bcrypt로 ownership 검증. IDOR 위험 없음.
- **XSS / 마크다운**: GOOD — sanitizer가 `defaultSchema` 기반, 커스텀 추가가 최소화되어 있습니다. (`JsonLd.tsx`의 `</script>` 이슈만 잔여)
- **CSRF**: GOOD — Server Action 사용.
- **비밀/환경변수**: GOOD — 분리·게이트가 모범적입니다.
- **레이트리밋**: GOOD — 댓글에 한정하지만 가장 노출이 큰 표면을 커버합니다. 로그인은 Supabase 기본에 의존.
- **헤더/쿠키**: 보통 — 대부분 설정됐으나 CSP·HSTS가 빠졌습니다.
- **API/Cron 인증**: GOOD — Bearer + `runtime: nodejs`. 타이밍 세이프 보완 권장.
- **이미지 remotePatterns 위험**: HIGH — SSRF 표면.

---

## 후속 액션 권고 (우선순위)

- [ ] **(HIGH)** 검색 LIKE 메타문자 이스케이프 (SEC-H-1)
- [ ] **(MEDIUM)** `remotePatterns` 호스트 화이트리스트 (SEC-M-1)
- [ ] **(MEDIUM)** CSP 헤더 도입 (SEC-M-2)
- [ ] **(MEDIUM)** RSS CDATA 종료 이스케이프 (SEC-M-3)
- [ ] **(MEDIUM)** 댓글 편집 토큰 만료/회전 정책 (SEC-M-4)
- [ ] **(LOW)** `JsonLd` `</script>` 이스케이프 (SEC-L-1)
- [ ] **(LOW)** Cron `timingSafeEqual` 적용 (SEC-L-4)
- [ ] **(LOW)** HSTS 헤더 추가 (인프라 리뷰 M-6 참조)
- [ ] **(LOW)** `eslint-config-next` 업그레이드로 glob CVE 정리 (SEC-L-5)

**판정**: COMMENT — Critical은 없으나 검색 인젝션(SEC-H-1)과 SSRF(SEC-M-1)는 우선 수정을 권장합니다.
