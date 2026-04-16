'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Layout from '@/components/Layout'
import MarkdownEditor from '@/components/MarkdownEditor'
import { createPost, type ActionState } from '@/app/actions/posts'

const initialState: ActionState = { ok: false }

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[가-힣]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="craft-card px-4 py-2 text-sm bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600 disabled:opacity-50"
    >
      {pending ? '저장 중…' : '저장'}
    </button>
  )
}

export default function NewPostPage() {
  const [state, formAction] = useFormState(createPost, initialState)

  const onTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const slugEl = document.getElementById('slug') as HTMLInputElement | null
    if (slugEl && !slugEl.value) {
      slugEl.value = slugify(e.target.value)
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-serif font-bold mb-6">새 글</h1>

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
            onBlur={onTitleBlur}
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
            placeholder="nextjs, supabase"
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
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">본문</label>
          <MarkdownEditor name="content" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" />
          <span>바로 발행</span>
        </label>

        {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </Layout>
  )
}
