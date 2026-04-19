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
  categoryId: string | null
}

const initialState: ActionState = { ok: false }

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-4 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200 disabled:opacity-50"
    >
      {pending ? '처리 중…' : label}
    </button>
  )
}

export default function EditPostForm({
  post,
  categoryPicker,
}: {
  post: PostDraft
  categoryPicker: React.ReactNode
}) {
  const update = updatePost.bind(null, post.id)
  const [state, formAction] = useFormState(update, initialState)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  async function onDelete() {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    await deletePost(post.id, post.slug)
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
              {state.ok && (
                <p className="text-sm text-green-700 dark:text-green-400">저장되었습니다.</p>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-craft-200 dark:border-ink-600 px-3 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
              >
                <Settings className="h-4 w-4" aria-hidden />
                설정
              </button>
              <SubmitButton label="저장" />
            </div>
          </>
        }
      >
        <div className="space-y-6">
          <TitleInput name="title" required defaultValue={post.title} />
          <TagInput name="tags" defaultTags={post.tags} />
          <MarkdownEditor name="content" defaultValue={post.content} />
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
            defaultValue={post.slug}
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

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={post.published} />
          <span>발행 상태</span>
        </label>

        <div className="pt-4 border-t border-craft-200 dark:border-ink-600">
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            이 글 삭제
          </button>
        </div>
      </PostSettingsDrawer>
    </form>
  )
}
