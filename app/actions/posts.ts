'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PostInput = {
  title: string
  slug: string
  content: string
  excerpt: string | null
  tags: string[]
  published: boolean
  coverImage?: string | null
  categoryId: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ActionState = { ok: boolean; error?: string; id?: string }

export async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: '로그인이 필요합니다.' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { supabase, error: '권한이 없습니다.' as const }
  return { supabase, error: null as null }
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function parseFormData(formData: FormData): PostInput {
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  let slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const content = (formData.get('content') as string | null) ?? ''
  const excerptRaw = (formData.get('excerpt') as string | null)?.trim() ?? ''
  const tagsRaw = (formData.get('tags') as string | null)?.trim() ?? ''
  const published = formData.get('published') === 'on' || formData.get('published') === 'true'
  const coverImage = ((formData.get('coverImage') as string | null)?.trim() ?? '') || null
  const categoryIdRaw = (formData.get('categoryId') as string | null)?.trim() ?? ''
  const categoryId = categoryIdRaw ? categoryIdRaw : null

  if (!slug && !published) {
    slug = `draft-${Date.now()}`
  }

  return {
    title,
    slug,
    content,
    excerpt: excerptRaw ? excerptRaw : null,
    tags: tagsRaw
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    published,
    coverImage,
    categoryId,
  }
}

function validate(input: PostInput): string | null {
  if (!input.title) return '제목을 입력해주세요.'
  if (input.published && !input.slug) return 'slug 를 입력해주세요.'
  if (input.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return 'slug 형식이 올바르지 않습니다. (소문자, 숫자, 하이픈만)'
  }
  if (input.published && !input.content.trim()) return '내용을 입력해주세요.'
  if (input.coverImage && !isHttpsUrl(input.coverImage)) {
    return '커버 이미지는 https URL 이어야 합니다.'
  }
  if (input.categoryId && !UUID_RE.test(input.categoryId)) {
    return '카테고리 식별자가 올바르지 않습니다.'
  }
  return null
}

function revalidateAll(...slugs: string[]) {
  revalidatePath('/')
  revalidatePath('/posts/[slug]', 'page')
  for (const slug of slugs.filter(Boolean)) {
    revalidatePath(`/posts/${slug}`)
  }
  revalidatePath('/admin/posts')
}

export async function createPost(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }

  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await guard.supabase
    .from('posts')
    .insert({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
      category_id: input.categoryId,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(data.slug)
  redirect(input.published ? '/admin/posts' : `/admin/posts/${data.id}/edit`)
}

export async function updatePost(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }

  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const { data: prev } = await guard.supabase
    .from('posts')
    .select('slug')
    .eq('id', id)
    .single()
  const oldSlug = prev?.slug ?? null

  const { error } = await guard.supabase
    .from('posts')
    .update({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
      category_id: input.categoryId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(input.slug, oldSlug ?? '')
  if (input.published) redirect('/admin/posts')
  return { ok: true }
}

export async function deletePost(id: string, slug: string): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }
  const { error } = await guard.supabase.from('posts').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateAll(slug)
  redirect('/admin/posts')
}

export async function publishPost(id: string, slug: string): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  const { error } = await guard.supabase.from('posts').update({ published: true }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateAll(slug)
  return { ok: true }
}

export async function unpublishPost(id: string, slug: string): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  const { error } = await guard.supabase.from('posts').update({ published: false }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateAll(slug)
  return { ok: true }
}

export async function logoutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  revalidatePath('/admin', 'layout')
  redirect('/admin/login')
}
