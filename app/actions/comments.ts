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
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '10 m'),
  })
  return ratelimit
}

function getIp(): string {
  const xff = headers().get('x-forwarded-for') ?? ''
  return (xff.split(',')[0] || headers().get('x-real-ip') || 'anonymous').trim()
}

// 댓글 본문의 줄바꿈을 보존하고 나머지 제어 문자와 일부 유니코드 서식 문자를 제거합니다.
// 정규식에 literal 컨트롤 문자를 박으면 git 이 binary 로 오인하므로 charCode 비교 방식 사용.
function stripUnsafe(s: string, preserveNewlines = false): string {
  let out = ''
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i)
    const isControl = (code <= 0x1f && !(preserveNewlines && code === 0x0a)) || code === 0x7f
    const isFormat =
      (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e)
    if (!isControl && !isFormat) out += s[i]
  }
  return out
}

function normalizeContent(content: string): string {
  return stripUnsafe(content.replace(/\r\n?/g, '\n'), true).trim().slice(0, 500)
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
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
  const postId = readText(formData, 'postId')
  const postSlug = readText(formData, 'postSlug')
  const authorName = stripUnsafe(readText(formData, 'authorName')).trim().slice(0, 50)
  const content = normalizeContent(readText(formData, 'content'))
  const password = readText(formData, 'password').trim()

  if (!postId || !postSlug) {
    return { ok: false, error: '잘못된 요청입니다.' }
  }
  if (!authorName || !content) {
    return { ok: false, error: '이름과 내용을 입력해주세요.' }
  }
  if (password.length < 4 || password.length > 20) {
    return { ok: false, error: '비밀번호는 4~20자로 입력해주세요.' }
  }

  const blocked = await checkRatelimit('create')
  if (blocked) return blocked

  const editToken = crypto.randomBytes(32).toString('hex')

  const supabase = createClient()

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, slug, title')
    .eq('id', postId)
    .eq('visibility', 'public')
    .maybeSingle()
  if (postError) {
    console.warn('[createComment] post lookup failed', postError)
    return { ok: false, error: '글을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }
  }
  if (!post || post.slug !== postSlug) {
    return { ok: false, error: '댓글을 작성할 수 없는 글입니다.' }
  }

  const { data: commentId, error } = await supabase.rpc('insert_comment', {
    p_post_id: postId,
    p_author_name: authorName,
    p_content: content,
    p_password: password,
    p_edit_token: editToken,
  })
  if (error || !commentId) {
    console.warn('[createComment] insert_comment failed', error)
    return { ok: false, error: '댓글 저장에 실패했습니다.' }
  }

  const previewLen = 120
  const preview =
    content.length > previewLen ? content.slice(0, previewLen) + '…' : content
  const url = `${site.url}/posts/${encodeURIComponent(postSlug)}`
  const msg = [
    `💬 <b>새 댓글</b> — ${escapeHtml(post.title)}`,
    `<b>${escapeHtml(authorName)}</b>: ${escapeHtml(preview)}`,
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
      author_name: authorName,
      content,
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

async function checkRatelimit(operation: 'create' | 'mutate'): Promise<{ ok: false; error: string } | null> {
  try {
    const limiter = getRatelimit()
    if (!limiter) {
      return process.env.NODE_ENV === 'production'
        ? { ok: false, error: '댓글 시스템 설정이 올바르지 않습니다.' }
        : null
    }
    const { success } = await limiter.limit(`comment-${operation}:${getIp()}`)
    if (!success) {
      return {
        ok: false,
        error: operation === 'create'
          ? '댓글을 너무 자주 작성하셨습니다. 잠시 후 다시 시도해주세요.'
          : '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.',
      }
    }
    return null
  } catch (error) {
    console.warn('[comments] rate limit check failed', error)
    return { ok: false, error: '댓글 기능에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }
}

export async function updateComment(
  args: MutateArgs & { newContent: string },
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const { commentId, postSlug, editToken } = args
  const password = args.password?.trim()
  const newContent = normalizeContent(args.newContent ?? '')
  if (!commentId || !postSlug) return { ok: false, error: '잘못된 요청입니다.' }
  if (!newContent) return { ok: false, error: '내용을 입력해주세요.' }
  if (!editToken && !password) return { ok: false, error: '비밀번호를 입력해주세요.' }

  const blocked = await checkRatelimit('mutate')
  if (blocked) return blocked

  const supabase = createClient()
  const { data, error } = await supabase.rpc('update_comment', {
    p_comment_id: commentId,
    p_new_content: newContent,
    p_edit_token: editToken ?? null,
    p_password: password ?? null,
  })
  if (error) {
    console.warn('[updateComment] rpc failed', error)
    return { ok: false, error: '댓글 수정에 실패했습니다.' }
  }
  if (!data) return { ok: false, error: '비밀번호가 일치하지 않습니다.' }

  return { ok: true, content: newContent }
}

export async function deleteComment(args: MutateArgs): Promise<MutateCommentResult> {
  const { commentId, postSlug, editToken } = args
  const password = args.password?.trim()
  if (!commentId || !postSlug) return { ok: false, error: '잘못된 요청입니다.' }
  if (!editToken && !password) return { ok: false, error: '비밀번호를 입력해주세요.' }

  const blocked = await checkRatelimit('mutate')
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
