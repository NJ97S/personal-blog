'use client'

import { useFormState, useFormStatus } from 'react-dom'
import MarkdownEditor from '@/components/MarkdownEditor'
import { updatePost, deletePost, type ActionState } from '@/app/actions/posts'

type PostDraft = {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  tags: string[]
  published: boolean
  coverImage: string
}

const initialState: ActionState = { ok: false }

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="craft-card px-4 py-2 text-sm bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600 disabled:opacity-50"
    >
      {pending ? '처리 중…' : label}
    </button>
  )
}

export default function EditPostForm({ post }: { post: PostDraft }) {
  const update = updatePost.bind(null, post.id)
  const [state, formAction] = useFormState(update, initialState)

  async function onDelete() {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    await deletePost(post.id, post.slug)
  }

  return (
    <>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm mb-1">
            제목
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={post.title}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm mb-1">
            slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            defaultValue={post.slug}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm mb-1">
            태그 (쉼표 구분)
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={post.tags.join(', ')}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm mb-1">
            요약 (선택)
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={2}
            defaultValue={post.excerpt}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="coverImage" className="block text-sm mb-1">
            커버 이미지 URL (선택)
          </label>
          <input
            id="coverImage"
            name="coverImage"
            type="url"
            defaultValue={post.coverImage}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">본문</label>
          <MarkdownEditor name="content" defaultValue={post.content} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={post.published} />
          <span>발행 상태</span>
        </label>

        {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700 dark:text-green-400">저장되었습니다.</p>}

        <div className="flex justify-end">
          <SubmitButton label="저장" />
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-craft-200 dark:border-ink-600">
        <button
          type="button"
          onClick={onDelete}
          className="text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          이 글 삭제
        </button>
      </div>
    </>
  )
}
