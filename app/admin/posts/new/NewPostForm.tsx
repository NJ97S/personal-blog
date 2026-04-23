'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import MarkdownEditor from '@/components/MarkdownEditor'
import TitleInput from '@/components/TitleInput'
import TagInput from '@/components/TagInput'
import PostEditorShell from '@/components/PostEditorShell'
import PublishModal from '@/components/PublishModal'
import { createPost } from '@/app/actions/posts'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

export default function NewPostForm({
  categoryPicker,
}: {
  categoryPicker: React.ReactNode
}) {
  const [title, setTitle] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const markDirty = useCallback(() => setDirty(true), [])

  const handleAction = useCallback(
    async (formData: FormData) => {
      setErrorMsg(null)
      const result = await createPost({ ok: false }, formData)
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
      }
    },
    [router],
  )

  const onTitleBlur = () => {
    const slugEl = document.getElementById('slug') as HTMLInputElement | null
    if (slugEl && !slugEl.value) {
      slugEl.value = slugify(title)
    }
  }

  const onExit = () => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) return
    router.push('/admin/posts')
  }

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
          <TitleInput value={title} onChange={setTitle} required onBlur={onTitleBlur} />
          <TagInput name="tags" onDirty={markDirty} />
          <MarkdownEditor name="content" height="calc(100vh - 260px)" />
        </div>
      </PostEditorShell>

      <PublishModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postTitle={title}
        defaultPublished={true}
        categoryPicker={categoryPicker}
      />
    </form>
  )
}
