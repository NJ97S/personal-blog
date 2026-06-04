import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegram, escapeHtml } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel 함수 최대 실행 시간을 명시. Hobby 플랜에서도 30s까지 허용되며,
// 24시간 윈도우 쿼리/Telegram 발송이 평소 수 초 안에 끝나므로 충분합니다.
export const maxDuration = 30

// 24시간 윈도우에서 합리적으로 다이제스트할 수 있는 상한.
// 그보다 많은 경우 절단되어도 다이제스트의 본질은 손상되지 않습니다.
const MAX_VIEWS = 10_000
const MAX_COMMENTS = 1_000

function safeBearerEqual(received: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!received || !secret) return false
  const expected = `Bearer ${secret}`
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // 길이 정보 노출 자체는 secret을 깨기에 충분하지 않으나,
    // 더미 비교로 타이밍 패턴을 균일하게 유지합니다.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!safeBearerEqual(req.headers.get('authorization'))) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 3600 * 1000)
  const sinceIso = since.toISOString()

  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    console.error('[digest] admin client init failed', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const [commentsRes, viewsRes] = await Promise.all([
    supabase
      .from('comments')
      .select('author_name, content, created_at, post_id, posts(title, slug)')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(MAX_COMMENTS),
    supabase
      .from('post_views')
      .select('post_id, posts(title, slug)')
      .gte('viewed_at', sinceIso)
      .limit(MAX_VIEWS),
  ])

  if (commentsRes.error) console.warn('[digest] comments query failed', commentsRes.error)
  if (viewsRes.error) console.warn('[digest] views query failed', viewsRes.error)

  const comments = commentsRes.data ?? []
  const views = viewsRes.data ?? []

  const totalPV = views.length
  const commentCount = comments.length

  type JoinedPost = { title: string; slug: string }
  const pickPost = (raw: unknown): JoinedPost | null => {
    if (!raw) return null
    const p = Array.isArray(raw) ? raw[0] : raw
    if (!p || typeof p !== 'object') return null
    const obj = p as Record<string, unknown>
    if (typeof obj.title !== 'string' || typeof obj.slug !== 'string') return null
    return { title: obj.title, slug: obj.slug }
  }

  const counts = new Map<string, { title: string; slug: string; n: number }>()
  for (const v of views) {
    const post = pickPost((v as { posts: unknown }).posts)
    if (!post) continue
    const cur = counts.get(v.post_id)
    if (cur) cur.n += 1
    else counts.set(v.post_id, { title: post.title, slug: post.slug, n: 1 })
  }
  const top = Array.from(counts.values()).sort((a, b) => b.n - a.n).slice(0, 5)

  const dateLabel = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`📊 <b>일일 다이제스트</b> (${dateLabel} KST)`)
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
    for (const c of comments.slice(0, 10)) {
      const post = pickPost((c as { posts: unknown }).posts)
      const title = post?.title ?? '(삭제된 글)'
      const preview = c.content.length > 60 ? c.content.slice(0, 60) + '…' : c.content
      lines.push(`• [${escapeHtml(title)}] ${escapeHtml(c.author_name)}: ${escapeHtml(preview)}`)
    }
    if (commentCount > 10) lines.push(`…외 ${commentCount - 10}건`)
  }

  await sendTelegram(lines.join('\n'))
  // 통계는 서버 로그로만 남기고, 외부 응답에는 노출하지 않습니다.
  console.info('[digest] dispatched', { totalPV, commentCount, top: top.length })
  return NextResponse.json({ ok: true })
}
