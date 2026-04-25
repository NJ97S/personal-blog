'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@/lib/supabase/server'
import { sendTelegram, escapeHtml } from '@/lib/telegram'
import { site } from '@/lib/site'

let ratelimit: Ratelimit | null = null
function getRatelimit() {
  if (ratelimit) return ratelimit
  try {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '10 m'),
    })
    return ratelimit
  } catch {
    return null
  }
}

export async function createComment(
  _prevState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const postId = (formData.get('postId') as string | null) ?? ''
  const postSlug = (formData.get('postSlug') as string | null) ?? ''
  const authorName = ((formData.get('authorName') as string | null) ?? '').trim().slice(0, 50)
  const content = ((formData.get('content') as string | null) ?? '').trim().slice(0, 500)

  if (!postId || !postSlug) {
    return { ok: false, error: '잘못된 요청입니다.' }
  }
  if (!authorName || !content) {
    return { ok: false, error: '이름과 내용을 입력해주세요.' }
  }

  const limiter = getRatelimit()
  if (limiter) {
    const xff = headers().get('x-forwarded-for') ?? ''
    const ip = (xff.split(',')[0] || headers().get('x-real-ip') || 'anonymous').trim()
    const { success } = await limiter.limit(ip)
    if (!success) {
      return {
        ok: false,
        error: '댓글을 너무 자주 작성하셨습니다. 잠시 후 다시 시도해주세요.',
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: '댓글 시스템 설정이 올바르지 않습니다.' }
  }

  const stripUnsafe = (s: string) =>
    s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, '')
  const safeName = stripUnsafe(authorName)
  const safeContent = stripUnsafe(content)

  const supabase = createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('id, slug, title')
    .eq('id', postId)
    .eq('visibility', 'public')
    .single()
  if (!post || post.slug !== postSlug) {
    return { ok: false, error: '댓글을 작성할 수 없는 글입니다.' }
  }

  const { error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_name: safeName, content: safeContent })

  if (error) return { ok: false, error: '댓글 저장에 실패했습니다.' }

  const previewLen = 120
  const preview =
    safeContent.length > previewLen ? safeContent.slice(0, previewLen) + '…' : safeContent
  const url = `${site.url}/posts/${encodeURI(postSlug)}`
  const msg = [
    `💬 <b>새 댓글</b> — ${escapeHtml(post.title)}`,
    `<b>${escapeHtml(safeName)}</b>: ${escapeHtml(preview)}`,
    `<a href="${escapeHtml(url)}">글로 이동</a>`,
  ].join('\n')
  sendTelegram(msg).catch(() => {})

  revalidatePath(`/posts/${postSlug}`)
  return { ok: true }
}
