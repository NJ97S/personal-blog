'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPostViewCounts } from '@/lib/views'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function visitorHash(): string | null {
  const h = headers()
  const ua = h.get('user-agent') ?? ''
  if (/bot|crawler|spider|slurp|preview/i.test(ua)) return null
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'anon').trim()
  // 날짜가 바뀌어도 4시간 중복 제거가 유지되도록 안정된 해시를 사용합니다.
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16)
}

export async function trackView(postId: string): Promise<number | null> {
  if (typeof postId !== 'string' || !UUID_RE.test(postId)) return null
  try {
    const hash = visitorHash()
    if (hash) {
      const { error } = await createClient().rpc('track_post_view', {
        p_post_id: postId, p_visitor_hash: hash, p_window_hours: 4,
      })
      if (error) console.warn('[trackView]', error.message)
    }
    return (await getPostViewCounts([postId])).get(postId) ?? null
  } catch (e) {
    console.warn('[trackView] failed', e)
    return null
  }
}

export async function trackBlogView(path: string): Promise<{ today: number; total: number } | null> {
  if (typeof path !== 'string' || path.length > 1024 || !/^(\/|\/search|\/(posts|categories|tags)\/[^\x00-\x1f?#]+)$/.test(path)) return null
  try {
    const hash = visitorHash()
    if (!hash) return null
    const supabase = createClient()
    const canonicalPath = decodeURIComponent(path)
    if (canonicalPath.startsWith('/posts/')) {
      const { data: post } = await supabase.from('posts').select('id')
        .eq('slug', canonicalPath.slice('/posts/'.length)).eq('visibility', 'public').maybeSingle()
      if (!post) return null
    }
    const { data, error } = await supabase.rpc('track_blog_view', {
      p_page_path: canonicalPath, p_visitor_hash: hash,
    })
    if (error) console.warn('[trackBlogView]', error.message)
    const row = data?.[0]
    return row ? { today: Number(row.today_views), total: Number(row.total_views) } : null
  } catch (e) {
    console.warn('[trackBlogView] failed', e)
    return null
  }
}
