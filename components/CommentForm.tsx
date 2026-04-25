'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useEffect, useRef } from 'react'
import { createComment, type CreateCommentState } from '@/app/actions/comments'
import { saveToken } from '@/lib/comment-tokens'

const initialState: CreateCommentState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="craft-card px-4 py-2 text-sm bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600 disabled:opacity-50"
    >
      {pending ? '등록 중…' : '댓글 남기기'}
    </button>
  )
}

export default function CommentForm({
  postId,
  postSlug,
}: {
  postId: string
  postSlug: string
}) {
  const [state, formAction] = useFormState(createComment, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      if (state.commentId && state.editToken) {
        saveToken(state.commentId, state.editToken)
      }
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="craft-card p-4 space-y-3">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="postSlug" value={postSlug} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="authorName" className="block text-sm mb-1">
            이름
          </label>
          <input
            id="authorName"
            name="authorName"
            type="text"
            required
            maxLength={50}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-craft-400"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1">
            비밀번호 <span className="text-xs text-ink-400">(수정·삭제 시 사용, 4~20자)</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={4}
            maxLength={20}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-craft-400"
          />
        </div>
      </div>

      <div>
        <label htmlFor="content" className="block text-sm mb-1">
          내용
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={4}
          maxLength={500}
          className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-craft-400"
        />
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 dark:text-green-400">댓글이 등록되었습니다.</p>}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}
