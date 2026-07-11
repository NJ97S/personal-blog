'use client'

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import MarkdownEditor from '@/components/MarkdownEditor'
import TitleInput from '@/components/TitleInput'
import TagInput from '@/components/TagInput'
import PostEditorShell from '@/components/PostEditorShell'
import PublishModal from '@/components/PublishModal'
import { createPost } from '@/app/actions/posts'
import { useHydrated } from '@/lib/use-hydrated'

const DESKTOP_EDITOR_HEIGHT = 'calc(100vh - 260px)'
const MOBILE_EDITOR_HEIGHT = 'max(320px, calc(100dvh - 22rem))'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const DraftButton = forwardRef<HTMLButtonElement, { ready: boolean }>(
  function DraftButton({ ready }, ref) {
    const { pending } = useFormStatus()
    const disabled = !ready || pending
    return (
      <button
        ref={ref}
        type="submit"
        name="visibility"
        value="draft"
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-ink-600 hover:text-ink-900 disabled:opacity-50 dark:text-craft-100 dark:hover:text-craft-50 sm:min-h-0"
      >
        {pending ? '저장 중…' : '임시저장'}
      </button>
    )
  },
)

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
  const hydrated = useHydrated()
  const formRef = useRef<HTMLFormElement>(null)
  const draftBtnRef = useRef<HTMLButtonElement>(null)
  const [editorHeight, setEditorHeight] = useState<string>(DESKTOP_EDITOR_HEIGHT)

  const markDirty = useCallback(() => setDirty(true), [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      setEditorHeight(media.matches ? MOBILE_EDITOR_HEIGHT : DESKTOP_EDITOR_HEIGHT)
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        const btn = draftBtnRef.current
        const form = formRef.current
        if (!btn || !form || btn.disabled) return
        form.requestSubmit(btn)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    <form ref={formRef} action={handleAction} onChange={markDirty}>
      <PostEditorShell
        actions={
          <>
            <button
              type="button"
              onClick={onExit}
              className="order-2 inline-flex min-h-11 shrink-0 items-center justify-start gap-1.5 px-3 py-1.5 text-sm text-ink-600 hover:text-ink-900 dark:text-craft-100 dark:hover:text-craft-50 sm:order-none sm:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              나가기
            </button>
            {errorMsg && (
              <p className="order-1 w-full text-right text-xs text-red-600 dark:text-red-400 sm:order-none sm:ml-auto sm:w-auto sm:text-sm">
                {errorMsg}
              </p>
            )}
            <div className="order-3 flex shrink-0 flex-wrap items-center justify-end gap-2 sm:order-none sm:gap-3">
              <DraftButton ref={draftBtnRef} ready={hydrated} />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-ink-800 bg-ink-800 px-4 py-1.5 text-sm text-craft-50 hover:bg-ink-600 dark:border-craft-50 dark:bg-craft-50 dark:text-ink-900 dark:hover:bg-craft-200 sm:min-h-0"
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
          <MarkdownEditor name="content" height={editorHeight} />
        </div>
      </PostEditorShell>

      <PublishModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postTitle={title}
        defaultVisibility="public"
        categoryPicker={categoryPicker}
      />
    </form>
  )
}
