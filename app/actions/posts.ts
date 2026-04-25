'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PostVisibility = 'public' | 'private' | 'draft'

export type PostInput = {
  title: string
  slug: string
  content: string
  excerpt: string | null
  tags: string[]
  visibility: PostVisibility
  coverImage?: string | null
  categoryId: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VISIBILITY_VALUES: PostVisibility[] = ['public', 'private', 'draft']

export type ActionState = {
  ok: boolean
  error?: string
  id?: string
  redirectTo?: string
  toast?: string
}

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

function parseVisibility(formData: FormData): PostVisibility {
  const raw = (formData.get('visibility') as string | null)?.trim() ?? ''
  if (VISIBILITY_VALUES.includes(raw as PostVisibility)) {
    return raw as PostVisibility
  }
  return 'draft'
}

function parseFormData(formData: FormData): PostInput {
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  let slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const content = (formData.get('content') as string | null) ?? ''
  const excerptRaw = (formData.get('excerpt') as string | null)?.trim() ?? ''
  const tagsRaw = (formData.get('tags') as string | null)?.trim() ?? ''
  const visibility = parseVisibility(formData)
  const coverImage = ((formData.get('coverImage') as string | null)?.trim() ?? '') || null
  const categoryIdRaw = (formData.get('categoryId') as string | null)?.trim() ?? ''
  const categoryId = categoryIdRaw ? categoryIdRaw : null

  if (!slug && visibility === 'draft') {
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
    visibility,
    coverImage,
    categoryId,
  }
}

function validate(input: PostInput): string | null {
  if (!input.title) return '제목을 입력해주세요.'
  const requiresFullForm = input.visibility !== 'draft'
  if (requiresFullForm && !input.slug) return 'slug 를 입력해주세요.'
  if (input.slug && !/^[a-zA-Z0-9가-힣]+(?:-[a-zA-Z0-9가-힣]+)*$/.test(input.slug)) {
    return 'slug 형식이 올바르지 않습니다. (문자/숫자/하이픈만, 공백·특수문자 불가)'
  }
  if (requiresFullForm && !input.content.trim()) return '내용을 입력해주세요.'
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

function toastForVisibility(visibility: PostVisibility): string | undefined {
  if (visibility === 'draft') return '임시저장 되었습니다.'
  if (visibility === 'private') return '비공개로 출간되었습니다.'
  return undefined
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
      visibility: input.visibility,
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

  if (input.visibility === 'draft') {
    return {
      ok: true,
      id: data.id,
      redirectTo: `/admin/posts/${data.id}/edit`,
      toast: toastForVisibility('draft'),
    }
  }

  return {
    ok: true,
    id: data.id,
    redirectTo: '/admin/posts',
    toast: toastForVisibility(input.visibility),
  }
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
      visibility: input.visibility,
      cover_image: input.coverImage,
      category_id: input.categoryId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(input.slug, oldSlug ?? '')
  return {
    ok: true,
    id,
    redirectTo: input.visibility === 'draft' ? undefined : '/admin/posts',
    toast: toastForVisibility(input.visibility),
  }
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
  const { error } = await guard.supabase
    .from('posts')
    .update({ visibility: 'public' })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateAll(slug)
  return { ok: true }
}

export async function unpublishPost(id: string, slug: string): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  const { error } = await guard.supabase
    .from('posts')
    .update({ visibility: 'draft' })
    .eq('id', id)
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
