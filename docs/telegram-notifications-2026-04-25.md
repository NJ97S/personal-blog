# 텔레그램 알림 시스템 구축 계획 (2026-04-25)

## 0. 요약

- **목표**: 블로그 운영자가 별도 대시보드 접속 없이 텔레그램으로 (1) 매일 아침 운영 다이제스트와 (2) 새 댓글 즉시 알림을 받는다.
- **범위**: Supabase 마이그레이션 1개, 서버 액션 2개, 라우트 1개, vercel.json cron 설정, env 3개, 기존 댓글 액션 1개 수정.
- **결정 사항**:
  - 다이제스트 주기: **매일 KST 08:00** (= cron `0 23 * * *` UTC)
  - **댓글 즉시 알림 포함** (silent fail로 댓글 저장 흐름은 절대 막지 않음)
- **비채택 옵션**: Vercel Analytics API(유료 플랜 필요), Plausible/Umami(외부 의존성 추가) — 일단 자체 PV 집계로 시작하고 정확도 이슈 시 교체.

---

## 1. 작업 배경과 전제

### 왜 이 작업이 필요했나
1. **운영 가시성 부재**: 현재 댓글이 달려도 관리자에게 알림이 가지 않음 → 답글 지연
2. **방문자 추이 미확인**: PV 트래킹 자체가 없음 → 어떤 글이 읽히는지, 트래픽 추세가 어떤지 파악 불가
3. **수동 확인 부담**: 매번 `/admin`에 들어가서 확인해야 함 → 운영 비용

### 개선 전 진단
| 영역 | 이전 상태 | 문제 |
|------|-----------|------|
| 댓글 알림 | 없음 | 댓글 도착 인지가 늦음 |
| PV 트래킹 | 없음 | 인기 글, 일일 트래픽 파악 불가 |
| 정기 리포트 | 없음 | 운영 현황을 능동적으로 받지 못함 |
| 외부 채널 | 없음 | 관리자 접속이 알림의 유일한 경로 |

### 전제
- Vercel Hobby 플랜에서도 cron 1일 1회는 사용 가능 (Pro로 올라갈 필요 없음)
- 텔레그램 봇은 무료, 본인 1명에게만 메시지 보내므로 rate limit 무시 가능
- 자체 PV 집계는 봇 트래픽이 일부 섞이지만, 개인 블로그 추이 파악 용도로는 충분

---

## 2. 아키텍처 개요

```
[방문자]
  └─> /posts/[slug]  ──(서버 액션)──> Supabase: post_views insert (4시간 dedup)

[방문자]
  └─> 댓글 작성 ──(createComment)──> comments insert
                                  └─> 텔레그램 sendMessage (즉시 알림, silent fail)

[Vercel Cron 매일 23:00 UTC = KST 08:00]
  └─> GET /api/cron/digest
       ├─ Authorization: Bearer ${CRON_SECRET} 검증
       ├─ 어제(KST 0~24시) comments 조회
       ├─ 어제 post_views 집계 (총 PV, TOP5)
       └─ 텔레그램 sendMessage (다이제스트)
```

---

## 3. 변경 대상 파일

### 신규
| 파일 | 역할 |
|------|------|
| `supabase/migrations/006_post_views.sql` | `post_views` 테이블 + 인덱스 + RLS |
| `lib/telegram.ts` | 텔레그램 sendMessage 헬퍼 (HTML 모드, silent fail) |
| `app/actions/views.ts` | PV 트래킹 서버 액션 (dedup 포함) |
| `app/api/cron/digest/route.ts` | 일일 다이제스트 cron 핸들러 |

### 수정
| 파일 | 변경 내용 |
|------|-----------|
| `app/posts/[slug]/page.tsx` | 공개 글 렌더 시 `trackView(post.id)` 호출 |
| `app/actions/comments.ts` | 댓글 저장 성공 후 텔레그램 즉시 알림 (try/catch) |
| `vercel.json` | `crons` 항목 추가 |

---

## 4. 상세 구현

### 4.1 Supabase 마이그레이션 (`006_post_views.sql`)

**스키마**

```sql
CREATE TABLE IF NOT EXISTS post_views (
  id           bigserial PRIMARY KEY,
  post_id      uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL,            -- sha256(ip + ua + daily_salt) 앞 16자
  viewed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id_viewed_at ON post_views(post_id, viewed_at DESC);

-- 4시간 dedup용 부분 unique constraint는 timestamp 비교가 어려우므로
-- 애플리케이션 레벨에서 (post_id, visitor_hash, 최근 4시간 내) 존재 체크 후 insert.

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- 서버 액션은 service role 또는 anon key로 동작.
-- 일반 사용자는 SELECT 불가, INSERT만 가능 (가벼운 spam 방지).
CREATE POLICY "Anyone can insert view" ON post_views
  FOR INSERT WITH CHECK (true);

-- 관리자만 조회 가능
CREATE POLICY "Admin read views" ON post_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

**왜 `visitor_hash`인가**
- 원본 IP를 저장하지 않아 PII 노출 최소화
- 일자별 salt를 섞어 장기간 재식별 방지 (cron에서 어제 데이터만 보면 되므로 일자별 salt면 충분)

**왜 4시간 dedup인가**
- 동일 방문자가 새로고침을 반복해도 PV가 부풀려지지 않음
- 정확한 unique 측정이 목적이 아니라 "추세 파악" 용도라 4시간이면 충분

### 4.2 텔레그램 헬퍼 (`lib/telegram.ts`)

```ts
const TELEGRAM_API = 'https://api.telegram.org'

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('[telegram] env not configured, skip')
    return false
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      // Vercel function 안에서 cron의 wall clock을 늘리지 않도록 짧게
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn('[telegram] non-200', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.warn('[telegram] send failed', e)
    return false
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
```

**설계 포인트**
- 호출 측은 절대 throw하지 않음 (boolean 반환). 댓글 저장이 알림 실패로 막히면 안 됨.
- `parse_mode: 'HTML'`을 쓰는 이유: 마크다운보다 escape 규칙이 단순하고 HTML 태그가 적게 필요한 디지스트 포맷에 적합.
- 5초 timeout: Vercel 함수 wall clock 보호.

### 4.3 PV 트래킹 액션 (`app/actions/views.ts`)

```ts
'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const DEDUP_WINDOW_HOURS = 4

export async function trackView(postId: string): Promise<void> {
  if (!postId) return
  try {
    const h = headers()
    const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'anon').trim()
    const ua = h.get('user-agent') ?? ''
    const dailySalt = new Date().toISOString().slice(0, 10)
    const visitorHash = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}|${dailySalt}`)
      .digest('hex')
      .slice(0, 16)

    const supabase = createClient()
    const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3600 * 1000).toISOString()

    const { data: recent } = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('visitor_hash', visitorHash)
      .gte('viewed_at', since)
      .limit(1)

    if (recent && recent.length > 0) return
    await supabase.from('post_views').insert({ post_id: postId, visitor_hash: visitorHash })
  } catch (e) {
    console.warn('[trackView] failed', e)
  }
}
```

**설계 포인트**
- 어떤 실패든 페이지 렌더에 영향 주지 않게 try/catch로 전부 흡수.
- dedup은 SELECT-then-INSERT라 race condition이 가능하지만, 같은 방문자가 1초 내 동시 접근하는 케이스는 무시 가능.
- crypto는 Node runtime 의존이므로 호출하는 page는 Node runtime 유지 필요 (현재 default가 Node라 별도 설정 불필요).

### 4.4 포스트 페이지 호출 (`app/posts/[slug]/page.tsx`)

`visibility = 'public'` 글이 렌더링될 때만 호출. fire-and-forget 패턴.

```tsx
import { trackView } from '@/app/actions/views'

// ...post 조회 후
if (post.visibility === 'public') {
  // await 하지 않음. 페이지 응답 지연 방지.
  trackView(post.id).catch(() => {})
}
```

**왜 await 안 하나**: PV 기록은 응답 지연을 만들 가치가 없음. 실패해도 사용자 경험에 영향 없음.

### 4.5 댓글 즉시 알림 (`app/actions/comments.ts` 수정)

기존 `createComment` 마지막, `revalidatePath` 호출 직전에 추가:

```ts
// 기존 insert 성공 직후
const { sendTelegram, escapeHtml } = await import('@/lib/telegram')
const previewLen = 120
const preview = safeContent.length > previewLen
  ? safeContent.slice(0, previewLen) + '…'
  : safeContent
const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/posts/${postSlug}`
const msg = [
  `💬 <b>새 댓글</b>`,
  `<b>${escapeHtml(safeName)}</b>: ${escapeHtml(preview)}`,
  `<a href="${escapeHtml(url)}">글로 이동</a>`,
].join('\n')
sendTelegram(msg).catch(() => {})

revalidatePath(`/posts/${postSlug}`)
return { ok: true }
```

**설계 포인트**
- `await` 없이 fire-and-forget. 텔레그램 응답을 기다리며 댓글 저장 응답을 늦추지 않음.
- 본문 미리보기는 120자 제한 (텔레그램 메시지 4096자 한도와 별개로 가독성 목적).
- HTML escape를 거쳐 본문에 `<script>` 같은 게 들어가도 안전.

### 4.6 일일 다이제스트 cron (`app/api/cron/digest/route.ts`)

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelegram, escapeHtml } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  // Vercel Cron이 자동으로 Authorization: Bearer ${CRON_SECRET} 헤더를 붙임
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  // KST 어제 0시 ~ 오늘 0시 (= UTC 어제 15:00 ~ 오늘 15:00)
  // cron이 KST 08:00 = UTC 23:00에 도는데, "어제 KST"는 UTC로 어제 15:00 ~ 오늘 15:00.
  // 그러나 cron이 도는 시점(UTC 23:00)에는 "오늘 15:00 UTC"가 미래.
  // → 대신 "직전 24시간"으로 단순화: now - 24h ~ now.
  // (운영 의미상 동일하고 timezone 계산 버그 없음)
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 3600 * 1000)
  const sinceIso = since.toISOString()

  const supabase = createClient()

  const [{ data: comments }, { data: views }] = await Promise.all([
    supabase
      .from('comments')
      .select('author_name, content, created_at, post_id, posts(title, slug, visibility)')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_views')
      .select('post_id, posts(title, slug)')
      .gte('viewed_at', sinceIso),
  ])

  const totalPV = views?.length ?? 0
  const commentCount = comments?.length ?? 0

  // TOP5 인기 글
  const counts = new Map<string, { title: string; slug: string; n: number }>()
  for (const v of views ?? []) {
    const post = (v as any).posts
    if (!post) continue
    const cur = counts.get(v.post_id)
    if (cur) cur.n += 1
    else counts.set(v.post_id, { title: post.title, slug: post.slug, n: 1 })
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 5)

  const lines: string[] = []
  lines.push(`📊 <b>일일 다이제스트</b> (${now.toISOString().slice(0, 10)})`)
  lines.push('')
  lines.push(`<b>방문</b>: PV ${totalPV} · 인기 글 ${top.length}개`)
  lines.push(`<b>댓글</b>: ${commentCount}건`)

  if (top.length) {
    lines.push('')
    lines.push('<b>TOP 5</b>')
    for (const t of top) {
      lines.push(`• ${escapeHtml(t.title)} — ${t.n}회`)
    }
  }

  if (commentCount) {
    lines.push('')
    lines.push('<b>새 댓글</b>')
    for (const c of (comments ?? []).slice(0, 10)) {
      const post = (c as any).posts
      const title = post?.title ?? '(삭제된 글)'
      const preview = c.content.length > 60 ? c.content.slice(0, 60) + '…' : c.content
      lines.push(`• [${escapeHtml(title)}] ${escapeHtml(c.author_name)}: ${escapeHtml(preview)}`)
    }
    if (commentCount > 10) lines.push(`…외 ${commentCount - 10}건`)
  }

  await sendTelegram(lines.join('\n'))
  return NextResponse.json({ ok: true, totalPV, commentCount, topCount: top.length })
}
```

**설계 포인트**
- **타임존 함정 회피**: "어제 KST 0~24시" 대신 "직전 24시간"을 쓴다. 매일 같은 시각에 돌기 때문에 운영 의미상 동일하고, timezone 산수 버그 가능성을 제거.
- `Promise.all`로 댓글/PV 병렬 조회.
- 다이제스트 본문이 비어도 (PV 0, 댓글 0) 메시지는 보냄 → "어제는 조용했다"는 정보 자체가 운영자에게 가치 있음.
- TOP5 집계는 in-memory (어차피 개인 블로그라 일일 view rows < 1만 가정).

### 4.7 vercel.json 수정

```json
{
  "regions": ["icn1"],
  "crons": [
    { "path": "/api/cron/digest", "schedule": "0 23 * * *" }
  ]
}
```

**왜 `0 23 * * *`인가**
- Vercel Cron은 UTC 기준
- KST 08:00 = UTC 전날 23:00
- 즉 매일 UTC 23:00에 실행 → KST 다음 날 08:00 도착 (수신 시점에서는 "방금 자정 직전 24시간 요약")

### 4.8 환경변수

| 키 | 환경 | 설명 |
|----|------|------|
| `TELEGRAM_BOT_TOKEN` | Production, Preview | @BotFather에서 받은 토큰 |
| `TELEGRAM_CHAT_ID` | Production, Preview | 본인 chat id (양수 또는 음수 정수) |
| `CRON_SECRET` | Production | Vercel Cron 인증용. `openssl rand -hex 32`로 생성 |
| `NEXT_PUBLIC_SITE_URL` | (이미 있다면 재사용) | 댓글 알림 메시지의 링크 prefix |

**`NEXT_PUBLIC_SITE_URL`이 없다면**: `lib/site.ts`의 SITE_URL을 import해 동일 효과. 코드 작성 시 확인.

---

## 5. 사용자 사전 작업 (코드 변경 전)

1. **봇 생성**
   - 텔레그램에서 `@BotFather` 검색 → `/newbot` → 봇 이름/유저네임 정하기 → **HTTP API token** 받기 (`TELEGRAM_BOT_TOKEN`)
2. **chat_id 확인**
   - 만든 봇과 대화 시작 → 아무 메시지나 1번 보내기
   - 브라우저에서 `https://api.telegram.org/bot<TOKEN>/getUpdates` 열기 → JSON 응답에서 `result[].message.chat.id` 복사 (`TELEGRAM_CHAT_ID`)
3. **CRON_SECRET 생성**
   - 터미널: `openssl rand -hex 32` 결과 복사
4. **Vercel 환경변수 등록**
   - `vercel env add TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET` (Production은 필수, Preview는 선택)
5. **Supabase 마이그레이션 실행**
   - `006_post_views.sql`을 Supabase Dashboard SQL Editor에 붙여 실행 (또는 CLI로 push)

---

## 6. 검증 계획

### 로컬 검증
- `app/posts/[slug]/page.tsx` 접속 → Supabase Studio에서 `post_views` row 1개 생성 확인
- 같은 IP/UA로 2분 후 재방문 → row 추가되지 않음 (4시간 dedup 작동)
- 댓글 작성 → 텔레그램에 즉시 도착 확인

### 프로덕션 검증
- Vercel Dashboard → Settings → Cron Jobs에서 "Run now" 버튼으로 수동 트리거 → 텔레그램에 다이제스트 도착 확인
- 다음 날 KST 08:00경 자동 메시지 도착 여부 확인
- 1주일 운영 후 `post_views` 일일 row 수가 합리적인 범위인지 (봇 트래픽 비중 점검)

### 실패 시나리오
| 시나리오 | 기대 동작 |
|----------|-----------|
| TELEGRAM_BOT_TOKEN 누락 | console.warn 후 silent skip, 댓글 저장은 정상 |
| 텔레그램 API 5초 timeout | 댓글 저장은 이미 끝났으므로 영향 없음 |
| Supabase 일시적 다운 | trackView, digest 모두 catch 후 무시 |
| CRON_SECRET 불일치 | 401 반환, 알림 미발송 (의도적) |

---

## 7. 작업 순서

| 단계 | 항목 | 비고 |
|------|------|------|
| 1 | 사용자: 봇 생성 + chat_id + CRON_SECRET 확보 | 5~10분 |
| 2 | `006_post_views.sql` 작성 + 실행 | DB 변경 먼저 |
| 3 | `lib/telegram.ts` 작성 | 공통 헬퍼 |
| 4 | `app/actions/views.ts` 작성 + `posts/[slug]/page.tsx` 호출 | PV 트래킹 |
| 5 | `app/actions/comments.ts` 수정 (즉시 알림) | 동작 검증 가능 |
| 6 | `app/api/cron/digest/route.ts` 작성 | |
| 7 | `vercel.json`에 cron 추가 | 마지막에 |
| 8 | Vercel 환경변수 등록 | 배포 전 필수 |
| 9 | 배포 → "Run now"로 cron 수동 검증 | |

---

## 8. 향후 확장 여지 (지금은 안 함)

- **봇 트래픽 필터**: User-Agent에 `bot|crawler|spider` 정규식 매칭 시 PV 제외
- **주간 다이제스트**: cron 1개 더 추가 (`0 23 * * 0`)
- **댓글 답글 기능**: 텔레그램 메시지에 inline keyboard 추가 → 답장이 봇 webhook 통해 admin 댓글로 들어가게
- **Vercel Analytics 통합**: 정확한 PV가 필요해지면 자체 집계 대신 사용 (Pro 플랜 필요)
- **에러 알림 통합**: 다이제스트와 같은 채널에 Sentry/Vercel error 알림도 통합

---

## 9. 결정 로그

| 결정 | 채택 | 사유 |
|------|------|------|
| PV 트래킹 방식 | 자체 집계 (Supabase) | 무료, 기존 스택 재사용. 정확도는 추세 파악 용도로 충분 |
| 다이제스트 시간 | KST 08:00 | 사용자 지정 |
| 댓글 알림 | 즉시 푸시 | 사용자 지정. 빈도 낮아 spam 아님 |
| 메시지 포맷 | HTML | escape 규칙 단순, 이모지/링크 자연스러움 |
| dedup 윈도우 | 4시간 | 새로고침 인플레 차단 + 동일인 다른 세션은 별도 카운트 |
| timezone 계산 | "직전 24시간" | KST 0~24시 계산 버그 회피 |
| cron 인증 | Bearer CRON_SECRET | Vercel Cron 표준 방식 |
| API 호출 실패 처리 | silent fail | 댓글 저장/페이지 렌더 차단 절대 금지 |
