import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegram, escapeHtml } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
    return NextResponse.json({ ok: false, error: 'admin client unavailable' }, { status: 500 })
  }

  const [commentsRes, viewsRes] = await Promise.all([
    supabase
      .from('comments')
      .select('author_name, content, created_at, post_id, posts(title, slug)')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_views')
      .select('post_id, posts(title, slug)')
      .gte('viewed_at', sinceIso),
  ])

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
  return NextResponse.json({ ok: true, totalPV, commentCount, topCount: top.length })
}
