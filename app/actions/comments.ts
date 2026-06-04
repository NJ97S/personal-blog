'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
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

function getIp(): string {
  const xff = headers().get('x-forwarded-for') ?? ''
  return (xff.split(',')[0] || headers().get('x-real-ip') || 'anonymous').trim()
}

// 컨트롤 문자(0x00-0x1F, 0x7F) 와 일부 Unicode 포맷(zero-width, BOM, RTL/LTR override) 제거.
// 정규식에 literal 컨트롤 문자를 박으면 git 이 binary 로 오인하므로 charCode 비교 방식 사용.
function stripUnsafe(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i)
    const isControl = code <= 0x1f || code === 0x7f
    const isFormat =
      (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e)
    if (!isControl && !isFormat) out += s[i]
  }
  return out
}

export type PublicComment = {
  id: string
  author_name: string
  content: string
  created_at: string
}

export type CreateCommentState = {
  ok: boolean
  error?: string
  commentId?: string
  editToken?: string
  comment?: PublicComment
  /** 동일 state 객체로도 useEffect 가 재발화하도록 매 호출마다 변경되는 nonce */
  nonce?: number
}

export async function createComment(
  _prevState: CreateCommentState,
  formData: FormData,
): Promise<CreateCommentState> {
  const postId = (formData.get('postId') as string | null) ?? ''
  const postSlug = (formData.get('postSlug') as string | null) ?? ''
  const authorName = ((formData.get('authorName') as string | null) ?? '').trim().slice(0, 50)
  const content = ((formData.get('content') as string | null) ?? '').trim().slice(0, 500)
  const password = ((formData.get('password') as string | null) ?? '').trim()

  if (!postId || !postSlug) {
    return { ok: false, error: '잘못된 요청입니다.' }
  }
  if (!authorName || !content) {
    return { ok: false, error: '이름과 내용을 입력해주세요.' }
  }
  if (password.length < 4 || password.length > 20) {
    return { ok: false, error: '비밀번호는 4~20자로 입력해주세요.' }
  }

  const limiter = getRatelimit()
  if (limiter) {
    const { success } = await limiter.limit(`comment-create:${getIp()}`)
    if (!success) {
      return {
        ok: false,
        error: '댓글을 너무 자주 작성하셨습니다. 잠시 후 다시 시도해주세요.',
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: '댓글 시스템 설정이 올바르지 않습니다.' }
  }

  const safeName = stripUnsafe(authorName)
  const safeContent = stripUnsafe(content)
  const editToken = crypto.randomBytes(32).toString('hex')

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

  const { data: commentId, error } = await supabase.rpc('insert_comment', {
    p_post_id: postId,
    p_author_name: safeName,
    p_content: safeContent,
    p_password: password,
    p_edit_token: editToken,
  })
  if (error || !commentId) {
    console.warn('[createComment] insert_comment failed', error)
    return { ok: false, error: '댓글 저장에 실패했습니다.' }
  }

  const previewLen = 120
  const preview =
    safeContent.length > previewLen ? safeContent.slice(0, previewLen) + '…' : safeContent
  const url = `${site.url}/posts/${encodeURI(postSlug)}`
  const msg = [
    `💬 <b>새 댓글</b> — ${escapeHtml(post.title)}`,
    `<b>${escapeHtml(safeName)}</b>: ${escapeHtml(preview)}`,
    `<a href="${escapeHtml(url)}">글로 이동</a>`,
  ].join('\n')
  // fire-and-forget: Telegram API가 느리거나 장애일 때(최대 5s) 사용자 응답을 막지 않습니다.
  // sendTelegram 내부에서 이미 모든 예외를 흡수하지만, 방어적으로 .catch도 둡니다.
  void sendTelegram(msg).catch((e) => {
    console.warn('[createComment] telegram dispatch failed', e)
  })

  return {
    ok: true,
    commentId: commentId as string,
    editToken,
    comment: {
      id: commentId as string,
      author_name: safeName,
      content: safeContent,
      created_at: new Date().toISOString(),
    },
    nonce: Date.now(),
  }
}

export type MutateCommentResult = { ok: boolean; error?: string }

type MutateArgs = {
  commentId: string
  postSlug: string
  editToken?: string | null
  password?: string | null
}

async function checkMutateRatelimit(): Promise<MutateCommentResult | null> {
  const limiter = getRatelimit()
  if (limiter) {
    const { success } = await limiter.limit(`comment-mutate:${getIp()}`)
    if (!success) {
      return {
        ok: false,
        error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.',
      }
    }
    return null
  }
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: '댓글 시스템 설정이 올바르지 않습니다.' }
  }
  return null
}

export async function updateComment(
  args: MutateArgs & { newContent: string },
): Promise<MutateCommentResult> {
  const { commentId, postSlug, editToken, password } = args
  const newContent = (args.newContent ?? '').trim().slice(0, 500)
  if (!commentId || !postSlug) return { ok: false, error: '잘못된 요청입니다.' }
  if (!newContent) return { ok: false, error: '내용을 입력해주세요.' }
  if (!editToken && !password) return { ok: false, error: '비밀번호를 입력해주세요.' }

  const blocked = await checkMutateRatelimit()
  if (blocked) return blocked

  const supabase = createClient()
  const { data, error } = await supabase.rpc('update_comment', {
    p_comment_id: commentId,
    p_new_content: stripUnsafe(newContent),
    p_edit_token: editToken ?? null,
    p_password: password ?? null,
  })
  if (error) {
    console.warn('[updateComment] rpc failed', error)
    return { ok: false, error: '댓글 수정에 실패했습니다.' }
  }
  if (!data) return { ok: false, error: '비밀번호가 일치하지 않습니다.' }

  return { ok: true }
}

export async function deleteComment(args: MutateArgs): Promise<MutateCommentResult> {
  const { commentId, postSlug, editToken, password } = args
  if (!commentId || !postSlug) return { ok: false, error: '잘못된 요청입니다.' }
  if (!editToken && !password) return { ok: false, error: '비밀번호를 입력해주세요.' }

  const blocked = await checkMutateRatelimit()
  if (blocked) return blocked

  const supabase = createClient()
  const { data, error } = await supabase.rpc('delete_comment', {
    p_comment_id: commentId,
    p_edit_token: editToken ?? null,
    p_password: password ?? null,
  })
  if (error) {
    console.warn('[deleteComment] rpc failed', error)
    return { ok: false, error: '댓글 삭제에 실패했습니다.' }
  }
  if (!data) return { ok: false, error: '비밀번호가 일치하지 않습니다.' }

  return { ok: true }
}
