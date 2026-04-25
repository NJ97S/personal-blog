'use client'

import { useEffect, useState } from 'react'
import { deleteComment, updateComment } from '@/app/actions/comments'
import { getToken, removeToken } from '@/lib/comment-tokens'
import PasswordInput from './PasswordInput'

type Comment = {
  id: string
  author_name: string
  content: string
  created_at: string
}

type Mode = 'view' | 'edit' | 'delete'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR')
  } catch {
    return iso
  }
}

export default function CommentItem({
  comment,
  postSlug,
}: {
  comment: Comment
  postSlug: string
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [editContent, setEditContent] = useState(comment.content)
  const [password, setPassword] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setHasToken(!!getToken(comment.id))
  }, [comment.id])

  const reset = () => {
    setMode('view')
    setPassword('')
    setError(null)
    setPending(false)
    setEditContent(comment.content)
  }

  const tokenOrPassword = () => {
    const editToken = getToken(comment.id)
    if (editToken) return { editToken, password: null as string | null }
    if (!password) {
      setError('비밀번호를 입력해주세요.')
      return null
    }
    return { editToken: null, password }
  }

  const onSaveEdit = async () => {
    setError(null)
    const trimmed = editContent.trim()
    if (!trimmed) {
      setError('내용을 입력해주세요.')
      return
    }
    if (trimmed === comment.content) {
      reset()
      return
    }
    const auth = tokenOrPassword()
    if (!auth) return
    setPending(true)
    const res = await updateComment({
      commentId: comment.id,
      postSlug,
      newContent: trimmed,
      ...auth,
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error ?? '수정에 실패했습니다.')
      return
    }
    reset()
  }

  const onConfirmDelete = async () => {
    setError(null)
    const auth = tokenOrPassword()
    if (!auth) return
    setPending(true)
    const res = await deleteComment({
      commentId: comment.id,
      postSlug,
      ...auth,
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error ?? '삭제에 실패했습니다.')
      return
    }
    removeToken(comment.id)
    // revalidatePath 가 서버에서 호출되어 댓글이 화면에서 사라짐
  }

  return (
    <li className="craft-card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <strong className="text-sm font-serif">{comment.author_name}</strong>
        <span className="text-xs text-ink-400">{formatDate(comment.created_at)}</span>
      </div>

      {mode === 'view' && (
        <>
          <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="mt-2 flex gap-3 text-xs text-ink-400">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="hover:text-ink-900 dark:hover:text-craft-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setMode('delete')}
              className="hover:text-red-600 dark:hover:text-red-400"
            >
              삭제
            </button>
          </div>
        </>
      )}

      {mode === 'edit' && (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-craft-400"
          />
          {!hasToken && (
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="작성 시 입력한 비밀번호"
              minLength={4}
              maxLength={20}
              autoComplete="current-password"
            />
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="px-3 py-1 text-ink-500 hover:text-ink-900 dark:hover:text-craft-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={pending}
              className="craft-card px-3 py-1 bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600 disabled:opacity-50"
            >
              {pending ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}

      {mode === 'delete' && (
        <div className="space-y-2">
          <p className="text-sm whitespace-pre-wrap break-words text-ink-500">
            {comment.content}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            이 댓글을 삭제하시겠어요? 되돌릴 수 없습니다.
          </p>
          {!hasToken && (
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="작성 시 입력한 비밀번호"
              minLength={4}
              maxLength={20}
              autoComplete="current-password"
            />
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="px-3 py-1 text-ink-500 hover:text-ink-900 dark:hover:text-craft-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={pending}
              className="craft-card px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
            >
              {pending ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
