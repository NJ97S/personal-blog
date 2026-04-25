'use client'

import { useEffect, useState } from 'react'
import { X, Globe, Lock, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const EXCERPT_MAX = 150
const MAX_COVER_BYTES = 5 * 1024 * 1024
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Props = {
  open: boolean
  onClose: () => void
  postTitle: string
  defaultSlug?: string
  defaultExcerpt?: string
  defaultCoverImage?: string
  defaultVisibility?: 'public' | 'private'
  categoryPicker: React.ReactNode
  dangerZone?: React.ReactNode
}

export default function PublishModal({
  open,
  onClose,
  postTitle,
  defaultSlug = '',
  defaultExcerpt = '',
  defaultCoverImage = '',
  defaultVisibility = 'public',
  categoryPicker,
  dangerZone,
}: Props) {
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility)
  const [excerpt, setExcerpt] = useState(defaultExcerpt)
  const [coverImage, setCoverImage] = useState(defaultCoverImage)
  const [uploading, setUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCoverError(null)

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setCoverError('JPEG, PNG, WebP 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('파일 크기는 최대 5MB 까지 가능합니다.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('post-covers')
        .upload(name, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const {
        data: { publicUrl },
      } = supabase.storage.from('post-covers').getPublicUrl(name)
      setCoverImage(publicUrl)
    } catch (err) {
      setCoverError(
        err instanceof Error ? `업로드 실패: ${err.message}` : '업로드 실패',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`fixed left-1/2 top-1/2 z-50 w-[880px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-craft-200 dark:border-ink-600 bg-craft-50 dark:bg-ink-900 shadow-xl transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-craft-200 dark:border-ink-600 px-5 py-3">
          <h2 className="font-serif font-bold text-sm">포스트 출간</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-600 dark:text-craft-100 hover:bg-craft-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="block text-sm font-bold mb-1.5">썸네일 이미지</p>
              <input
                type="hidden"
                name="coverImage"
                value={coverImage}
                readOnly
              />
              {coverImage && (
                <div className="mb-2 relative aspect-video overflow-hidden rounded-sm border border-craft-200 dark:border-ink-600 bg-craft-100 dark:bg-ink-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImage}
                    alt="썸네일 미리보기"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-craft-200 dark:border-ink-600 px-3 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800">
                  <Upload className="h-4 w-4" aria-hidden />
                  {coverImage ? '파일 교체' : '파일 선택'}
                  <input
                    type="file"
                    accept={ALLOWED_COVER_TYPES.join(',')}
                    onChange={onFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {coverImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImage('')
                      setCoverError(null)
                    }}
                    className="text-sm text-ink-400 hover:text-red-600"
                  >
                    제거
                  </button>
                )}
              </div>
              {uploading && (
                <p className="mt-1 text-xs text-ink-400">업로드 중…</p>
              )}
              {coverError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {coverError}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-400">
                또는 URL 직접 입력 (JPEG/PNG/WebP · 최대 5MB)
              </p>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <p className="block text-sm font-bold mb-1.5">제목</p>
              <p className="text-sm text-ink-600 dark:text-craft-100 break-words">
                {postTitle || <span className="text-ink-400">(제목 없음)</span>}
              </p>
            </div>

            <div>
              <label htmlFor="excerpt" className="block text-sm font-bold mb-1.5">
                소개글 (선택)
              </label>
              <textarea
                id="excerpt"
                name="excerpt"
                rows={4}
                maxLength={EXCERPT_MAX}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="글을 짧게 소개해보세요"
                className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm resize-none"
              />
              <p className="mt-1 text-right text-xs text-ink-400">
                {excerpt.length}/{EXCERPT_MAX}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="block text-sm font-bold mb-1.5">공개 설정</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  aria-pressed={visibility === 'public'}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    visibility === 'public'
                      ? 'border-ink-800 dark:border-craft-50 text-ink-900 dark:text-craft-50'
                      : 'border-craft-200 dark:border-ink-600 text-ink-500 dark:text-craft-200'
                  }`}
                >
                  <Globe className="h-4 w-4" aria-hidden />
                  전체 공개
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  aria-pressed={visibility === 'private'}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    visibility === 'private'
                      ? 'border-ink-800 dark:border-craft-50 text-ink-900 dark:text-craft-50'
                      : 'border-craft-200 dark:border-ink-600 text-ink-500 dark:text-craft-200'
                  }`}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  비공개
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-1.5">
                URL 설정
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                defaultValue={defaultSlug}
                pattern="^[a-zA-Z0-9가-힣]+(?:-[a-zA-Z0-9가-힣]+)*$"
                className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <p className="block text-sm font-bold mb-1.5">시리즈 설정</p>
              {categoryPicker}
            </div>
          </div>
        </div>

        {dangerZone && (
          <div className="border-t border-craft-200 dark:border-ink-600 px-5 py-3">
            {dangerZone}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-craft-200 dark:border-ink-600 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-ink-600 dark:text-craft-100 hover:text-ink-900 dark:hover:text-craft-50"
          >
            취소
          </button>
          <button
            type="submit"
            name="visibility"
            value={visibility === 'public' ? 'public' : 'private'}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-4 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200 disabled:opacity-50"
          >
            {visibility === 'public' ? '출간하기' : '비공개 출간'}
          </button>
        </div>
      </div>
    </>
  )
}
