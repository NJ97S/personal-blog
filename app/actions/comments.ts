'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@/lib/supabase/server'

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
    const ip = headers().get('x-forwarded-for') ?? 'anonymous'
    const { success } = await limiter.limit(ip)
    if (!success) {
      return {
        ok: false,
        error: '댓글을 너무 자주 작성하셨습니다. 잠시 후 다시 시도해주세요.',
      }
    }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_name: authorName, content })

  if (error) return { ok: false, error: '댓글 저장에 실패했습니다.' }

  revalidatePath(`/posts/${postSlug}`)
  return { ok: true }
}
