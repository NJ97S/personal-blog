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
}

export type ActionState = { ok: boolean; error?: string; id?: string }

function parseFormData(formData: FormData): PostInput {
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const content = (formData.get('content') as string | null) ?? ''
  const excerptRaw = (formData.get('excerpt') as string | null)?.trim() ?? ''
  const tagsRaw = (formData.get('tags') as string | null)?.trim() ?? ''
  const published = formData.get('published') === 'on' || formData.get('published') === 'true'
  const coverImage = ((formData.get('coverImage') as string | null)?.trim() ?? '') || null

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
  }
}

function validate(input: PostInput): string | null {
  if (!input.title) return '제목을 입력해주세요.'
  if (!input.slug) return 'slug 를 입력해주세요.'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return 'slug 형식이 올바르지 않습니다. (소문자, 숫자, 하이픈만)'
  }
  if (!input.content.trim()) return '내용을 입력해주세요.'
  return null
}

function revalidateAll(slug: string) {
  revalidatePath('/')
  revalidatePath('/posts/[slug]', 'page')
  revalidatePath(`/posts/${slug}`)
  revalidatePath('/admin/posts')
}

export async function createPost(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(data.slug)
  redirect(`/admin/posts/${data.id}/edit`)
}

export async function updatePost(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createClient()
  const { error } = await supabase
    .from('posts')
    .update({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(input.slug)
  return { ok: true }
}

export async function deletePost(id: string, slug: string) {
  const supabase = createClient()
  await supabase.from('posts').delete().eq('id', id)
  revalidateAll(slug)
  redirect('/admin/posts')
}

export async function publishPost(id: string, slug: string) {
  const supabase = createClient()
  await supabase.from('posts').update({ published: true }).eq('id', id)
  revalidateAll(slug)
}

export async function unpublishPost(id: string, slug: string) {
  const supabase = createClient()
  await supabase.from('posts').update({ published: false }).eq('id', id)
  revalidateAll(slug)
}

export async function logoutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
