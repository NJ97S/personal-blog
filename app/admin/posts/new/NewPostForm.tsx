'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { ArrowLeft, Settings } from 'lucide-react'
import MarkdownEditor from '@/components/MarkdownEditor'
import TitleInput from '@/components/TitleInput'
import TagInput from '@/components/TagInput'
import PostEditorShell from '@/components/PostEditorShell'
import PostSettingsDrawer from '@/components/PostSettingsDrawer'
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-4 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200 disabled:opacity-50"
    >
      {pending ? '저장 중…' : '저장'}
    </button>
  )
}

export default function NewPostForm({
  categoryPicker,
}: {
  categoryPicker: React.ReactNode
}) {
  const [state, formAction] = useFormState(createPost, initialState)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  const onTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const slugEl = document.getElementById('slug') as HTMLInputElement | null
    if (slugEl && !slugEl.value) {
      slugEl.value = slugify(e.target.value)
    }
  }

  return (
    <form action={formAction}>
      <PostEditorShell
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push('/admin/posts')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-600 dark:text-craft-100 hover:text-ink-900 dark:hover:text-craft-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              나가기
            </button>
            <div className="flex items-center gap-3">
              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-craft-200 dark:border-ink-600 px-3 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
              >
                <Settings className="h-4 w-4" aria-hidden />
                설정
              </button>
              <SubmitButton />
            </div>
          </>
        }
      >
        <div className="space-y-6">
          <TitleInput name="title" required onBlur={onTitleBlur} />
          <TagInput name="tags" />
          <MarkdownEditor name="content" height="calc(100vh - 260px)" />
        </div>
      </PostEditorShell>

      <PostSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
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

        {categoryPicker}

        <div>
          <label htmlFor="excerpt" className="block text-sm mb-1">
            요약 (선택)
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={3}
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

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" />
          <span>바로 발행</span>
        </label>
      </PostSettingsDrawer>
    </form>
  )
}
