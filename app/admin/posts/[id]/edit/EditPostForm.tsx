'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import MarkdownEditor from '@/components/MarkdownEditor'
import TitleInput from '@/components/TitleInput'
import TagInput from '@/components/TagInput'
import PostEditorShell from '@/components/PostEditorShell'
import PublishModal from '@/components/PublishModal'
import { updatePost, deletePost } from '@/app/actions/posts'

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

function DraftButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="published"
      value="false"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-600 dark:text-craft-100 hover:text-ink-900 dark:hover:text-craft-50 disabled:opacity-50"
    >
      {pending ? '저장 중…' : '임시저장'}
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
  const [title, setTitle] = useState(post.title)
  const [modalOpen, setModalOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('editor-toast')
      if (stored) {
        toast.success(stored)
        sessionStorage.removeItem('editor-toast')
      }
    } catch {}
  }, [])

  const markDirty = useCallback(() => {
    setDirty(true)
  }, [])

  const handleAction = useCallback(
    async (formData: FormData) => {
      setErrorMsg(null)
      const result = await updatePost(post.id, { ok: false }, formData)
      if (!result.ok) {
        setErrorMsg(result.error ?? '저장에 실패했습니다.')
        return
      }
      if (result.toast && result.redirectTo) {
        try {
          sessionStorage.setItem('editor-toast', result.toast)
        } catch {}
      }
      if (result.redirectTo) {
        router.replace(result.redirectTo)
        return
      }
      setDirty(false)
      if (result.toast) {
        toast.success(result.toast)
      }
    },
    [post.id, router],
  )

  const onExit = () => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) return
    router.push('/admin/posts')
  }

  async function onDelete() {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    await deletePost(post.id, post.slug)
  }

  const dangerZone = (
    <button
      type="button"
      onClick={onDelete}
      className="text-sm text-red-600 dark:text-red-400 hover:underline"
    >
      이 글 삭제
    </button>
  )

  return (
    <form action={handleAction} onChange={markDirty}>
      <PostEditorShell
        actions={
          <>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-600 dark:text-craft-100 hover:text-ink-900 dark:hover:text-craft-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              나가기
            </button>
            <div className="flex items-center gap-3">
              {errorMsg && (
                <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
              )}
              <DraftButton />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-4 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200"
              >
                출간하기
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-6">
          <TitleInput value={title} onChange={setTitle} required />
          <TagInput name="tags" defaultTags={post.tags} onDirty={markDirty} />
          <MarkdownEditor name="content" defaultValue={post.content} height="calc(100vh - 260px)" />
        </div>
      </PostEditorShell>

      <PublishModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postTitle={title}
        defaultSlug={post.slug}
        defaultExcerpt={post.excerpt}
        defaultCoverImage={post.coverImage}
        defaultPublished={post.published}
        categoryPicker={categoryPicker}
        dangerZone={dangerZone}
      />
    </form>
  )
}
