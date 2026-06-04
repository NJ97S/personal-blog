# 인프라 / 서버액션 / API 코드리뷰

> 검토자: `code-reviewer` · 검토일: 2026-06-01 · 범위: `lib/**`, `middleware.ts`, `app/actions/**`, `app/api/**`, `app/admin/**`, `supabase/`, 루트 설정 파일

## 요약
- 검토 파일 수: 30+
- 심각도 분포: **CRITICAL 0 · HIGH 3 · MEDIUM 6 · LOW 3 · INFO 3**
- 핵심 발견: 즉시 코드를 깨는 Critical 이슈는 없으나, `images.remotePatterns` 와일드카드(`**`), CSP 헤더 부재, `publishPost/unpublishPost`의 UUID 미검증, `escapeHtml`의 따옴표 미처리, `reorderCategory` 트랜잭션 부재 등 운영 위험이 누적될 수 있는 항목이 있습니다.

---

## 발견사항

### 🔴 Critical

없습니다.

### 🟠 High

#### [H-1] `next.config.mjs:5` — `images.remotePatterns` 호스트 `**`
```js
{ protocol: 'https', hostname: '**' },
```
- 모든 외부 HTTPS 호스트의 이미지를 Next.js 이미지 옵티마이저가 프록시합니다. 관리자/사용자가 임의 URL을 커버 이미지로 지정하면 서버가 해당 URL을 fetch해 SSRF 벡터 및 대역폭 남용 위험이 생깁니다.
- **권장 조치**: 실제 사용 호스트만 명시.
  ```js
  remotePatterns: [
    { protocol: 'https', hostname: '*.supabase.co' },
    // 추가 호스트만
  ],
  ```

#### [H-2] `next.config.mjs` — Content-Security-Policy 헤더 부재
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`는 있으나 CSP가 없습니다. 어떤 XSS 우회가 발견되더라도 방어선이 없습니다.
- **권장 조치**: 최소 CSP 베이스라인 도입.
  ```js
  { key: 'Content-Security-Policy', value:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';" }
  ```

#### [H-3] `app/actions/posts.ts:237-247, 249-259` — `publishPost`/`unpublishPost` UUID 미검증
- 같은 파일의 `createPost`, `updatePost`, `deletePost`는 `UUID_RE.test(id)`로 검증하지만 `publishPost`/`unpublishPost`는 누락되었습니다. 임의 문자열이 `.eq('id', id)`에 들어갑니다.
- **권장 조치**:
  ```ts
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }
  ```

### 🟡 Medium

#### [M-1] `lib/telegram.ts:34-36` — `escapeHtml`이 `"`/`'`를 이스케이프하지 않음
- `&`, `<`, `>`만 처리합니다. `app/actions/comments.ts:129`에서 `<a href="${escapeHtml(url)}">` 형태로 속성값에 삽입되므로 URL에 `"`가 있으면 속성 컨텍스트를 탈출하여 텔레그램 메시지 HTML 인젝션이 가능합니다.
- **권장 조치**: 5문자 모두 처리.
  ```ts
  s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]!)
  ```

#### [M-2] `app/actions/categories.ts:139-190` — `reorderCategory` TOCTOU 레이스
- 형제 목록 조회 → 두 건의 개별 UPDATE를 단일 트랜잭션 없이 수행합니다. 동시 호출 시 `sort_order` 충돌, 첫 UPDATE 성공 후 두 번째 실패 시 데이터 불일치 가능.
- **권장 조치**: Supabase RPC (SECURITY DEFINER) 함수로 두 UPDATE를 단일 트랜잭션에 묶거나 `.rpc()` 호출로 대체합니다.

#### [M-3] `app/actions/comments.ts:131` — `sendTelegram` await 블로킹
- 댓글 저장 후 Telegram 알림을 `await`하므로 외부 API 장애 시 사용자 응답이 최대 5초(AbortSignal.timeout) 지연됩니다.
- **권장 조치**: fire-and-forget 또는 Vercel `waitUntil`.
  ```ts
  void sendTelegram(msg)
  ```

#### [M-4] `app/api/cron/digest/route.ts` — 타임아웃 보호 부재
- Vercel 기본 타임아웃 한계 내에서 `post_views`/`comments`가 커지면 24시간 윈도우 쿼리가 느려질 수 있습니다.
- **권장 조치**: `export const maxDuration = 30` 명시와 결과 `.limit()` 적용.

#### [M-5] `app/admin/**` — 미들웨어가 `is_admin`을 확인하지 않음
- `lib/supabase/middleware.ts`는 `getUser()` 존재 여부만 보고 `is_admin` 플래그는 확인하지 않습니다. 즉, 일반 가입 사용자도 `/admin/*` 페이지 렌더링에 도달할 수 있습니다. 서버 액션은 `requireAdmin()`으로 보호되므로 실제 데이터 변경은 차단되지만, UI 노출 자체가 정보 누출입니다.
- **영향 파일**: `app/admin/posts/page.tsx`, `app/admin/posts/[id]/edit/page.tsx`, `app/admin/categories/page.tsx`.
- **권장 조치**: 미들웨어에서 `is_admin` 조회를 추가하거나 각 admin 서버 컴포넌트 상단에서 `requireAdmin()`을 호출합니다.

#### [M-6] `next.config.mjs` — HSTS 헤더 부재
- Vercel은 HTTPS를 강제하지만 첫 접속 시 다운그레이드 공격에 노출됩니다.
- **권장 조치**:
  ```js
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
  ```

### 🟢 Low

- **[L-1] `app/api/cron/digest/route.ts:92`** — 응답으로 `totalPV`, `commentCount` 등 내부 통계 노출. CRON_SECRET으로 보호되지만 `{ ok: true }`만 반환해도 충분합니다.
- **[L-2] `app/actions/posts.ts:261-266`** — `logoutAction`은 인증 확인 없이 호출 가능. 기능적 문제는 없으나 불필요한 `signOut` 호출이 발생합니다.
- **[L-3] `lib/supabase/server.ts:19`** — 빈 catch. 의도적이라는 주석은 있으나, `console.debug`라도 추가하면 디버깅이 쉬워집니다.

### ℹ️ Info

- **[I-1] TypeScript 컴파일**: `.next/types/app/scroll-test/page.ts` 잔여 오류 2건. `.next` 재생성으로 해소.
- **[I-2] `vercel.json` cron**: `0 23 * * *` (KST 08:00) 일일 다이제스트 적절.
- **[I-3] admin 페이지에 `force-dynamic`** 사용 — 관리자 페이지 특성상 적절.

---

## 영역별 메모

### Supabase 통합
- **Service Role Key 격리**: `createAdminClient()`는 `lib/supabase/admin.ts`에만 정의, 유일한 사용처는 `app/api/cron/digest/route.ts`. 클라이언트 번들 누출 경로 없음.
- **Cookie 처리**: `lib/supabase/middleware.ts`는 Supabase SSR 공식 패턴을 정확히 따릅니다.
- **`getUser()` 사용**: `getSession()` 대신 `getUser()`로 JWT 서버 검증을 강제 — 모범 사례.
- **RLS 설계**: SECURITY DEFINER RPC + `search_path` 설정 + `public_comments` 뷰로 민감 컬럼(`password_hash`, `edit_token`) 격리.

### 서버 액션
- 모든 파일에 `'use server'` 정상 선언.
- 관리자 액션은 `requireAdmin()` 가드를 일관 적용. 다만 `publishPost`/`unpublishPost`만 UUID 검증 누락 (H-3).
- 댓글 시스템: Upstash Redis 기반 rate limit이 잘 구현되어 있으며, 프로덕션에서 Redis 미설정 시 댓글 기능을 비활성화하는 fail-closed 동작이 좋습니다.
- 입력 검증: `stripUnsafe()`, 길이 제한, UUID, slug 정규식이 광범위하게 적용됩니다.

### 미들웨어
- 매처 `/admin/:path*`로 공개 페이지 오버헤드 없음.
- 리다이렉트 루프 방어: `/admin/login`은 보호 제외 + 인증 시 `/admin/posts` 리다이렉트.
- `is_admin` 미확인은 M-5 참조.

### API / Cron
- `CRON_SECRET` Bearer 인증.
- GET, idempotent.
- `runtime = 'nodejs'` 명시.
- 단, Supabase 쿼리 실패 시 에러 핸들링이 부족해 조용히 빈 다이제스트가 발송될 수 있습니다.

### 관리자 페이지
- 로그인 페이지는 Supabase Auth `signInWithPassword` 클라이언트 컴포넌트로 적절.
- 에디터는 `useHydrated()`로 하이드레이션 전 submit 방지.
- Ctrl+S 단축키와 dirty state 관리가 잘 구현되어 있습니다.
- `CategoryAdmin.tsx`의 TreeRow 3단계 수동 중첩(126-182)은 재귀 컴포넌트로 정리하면 유지보수성이 좋아집니다.

### Telegram 알림
- 토큰 미설정 시 graceful skip.
- `AbortSignal.timeout(5000)`으로 무한 대기 방지.
- 실패는 `false` 반환, 호출자에 에러 전파 없음.

---

## 좋은 점
1. Supabase 보안 모범 사례 준수: `getUser()` 사용, Service Role Key 격리, SECURITY DEFINER RPC + `search_path`, `public_comments` 뷰.
2. 댓글 시스템 설계: bcrypt + edit token + soft delete + rate limit + 컨트롤 문자 제거.
3. 입력 검증 일관성.
4. 카테고리 순환 참조 방지: `updateCategory`에서 자기/하위 카테고리 부모 지정 차단.
5. 미들웨어 리다이렉트 루프 방지.
6. 조회수 dedup: visitor hash + 4시간 윈도우 + SECURITY DEFINER RPC가 공개 글에만 카운팅.

---

## 후속 액션 권고

| 우선순위 | 항목 | 참조 |
|:---|:---|:---|
| 높음 | `images.remotePatterns` 호스트 제한 | H-1 |
| 높음 | CSP 헤더 추가 | H-2 |
| 높음 | `publishPost`/`unpublishPost` UUID 검증 | H-3 |
| 중간 | `escapeHtml` 따옴표 이스케이프 | M-1 |
| 중간 | 미들웨어 또는 admin 페이지 `is_admin` 확인 | M-5 |
| 중간 | HSTS 헤더 추가 | M-6 |
| 중간 | Telegram fire-and-forget | M-3 |
| 중간 | `reorderCategory` 트랜잭션 보장 | M-2 |
| 중간 | cron `maxDuration` 명시 | M-4 |
| 낮음 | cron 응답에서 내부 통계 제거 | L-1 |

**Verdict**: COMMENT — CRITICAL은 없으나 HIGH 3건은 변경량이 매우 작으므로 즉시 수정을 권장합니다.
