'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './posts'
import { fetchCategoryTree, walkTree, collectDescendantIds } from '@/lib/categories'

export type CategoryInput = {
  name: string
  slug: string
  parentId: string | null
}

export type ActionState = { ok: boolean; error?: string; id?: string }

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validate(input: CategoryInput): string | null {
  if (!input.name.trim()) return '이름을 입력해주세요.'
  if (!input.slug.trim()) return 'slug 를 입력해주세요.'
  if (!SLUG_RE.test(input.slug)) {
    return 'slug 형식이 올바르지 않습니다. (소문자, 숫자, 하이픈만)'
  }
  if (input.parentId && !UUID_RE.test(input.parentId)) {
    return '상위 카테고리 식별자가 올바르지 않습니다.'
  }
  return null
}

function revalidateAll() {
  revalidatePath('/', 'layout')
  revalidatePath('/admin/categories')
  revalidatePath('/admin/posts')
  revalidatePath('/sitemap.xml')
}

function mapDbError(code: string | undefined, fallback: string): string {
  if (code === '23505') return '같은 상위 아래 이미 사용 중인 slug 입니다.'
  return fallback
}

async function nextSortOrder(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  parentId: string | null,
): Promise<number> {
  let query = supabase.from('categories').select('sort_order')
  query = parentId === null ? query.is('parent_id', null) : query.eq('parent_id', parentId)
  const { data } = await query
  const max = (data ?? []).reduce(
    (acc, row) => Math.max(acc, Number(row.sort_order) || 0),
    -1,
  )
  return max + 1
}

export async function createCategory(input: CategoryInput): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }

  const err = validate(input)
  if (err) return { ok: false, error: err }

  const sortOrder = await nextSortOrder(guard.supabase, input.parentId)
  const { data, error } = await guard.supabase
    .from('categories')
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      parent_id: input.parentId,
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: mapDbError(error.code, error.message) }

  revalidateAll()
  return { ok: true, id: data.id }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }

  const err = validate(input)
  if (err) return { ok: false, error: err }

  if (input.parentId === id) {
    return { ok: false, error: '자기 자신을 상위 카테고리로 지정할 수 없습니다.' }
  }
  if (input.parentId) {
    const tree = await fetchCategoryTree()
    const me = walkTree(tree).find((n) => n.id === id)
    if (me) {
      const descendantIds = new Set(collectDescendantIds(me))
      if (descendantIds.has(input.parentId)) {
        return {
          ok: false,
          error: '하위 카테고리로는 이동할 수 없습니다.',
        }
      }
    }
  }

  const { error } = await guard.supabase
    .from('categories')
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      parent_id: input.parentId,
    })
    .eq('id', id)

  if (error) return { ok: false, error: mapDbError(error.code, error.message) }

  revalidateAll()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }

  const { error } = await guard.supabase.from('categories').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidateAll()
  return { ok: true }
}

export async function reorderCategory(
  id: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }

  const { data: target } = await guard.supabase
    .from('categories')
    .select('id, parent_id, sort_order')
    .eq('id', id)
    .single()

  if (!target) return { ok: false, error: '카테고리를 찾을 수 없습니다.' }

  let siblingsQuery = guard.supabase
    .from('categories')
    .select('id, sort_order')
    .order('sort_order', { ascending: true })
  siblingsQuery =
    target.parent_id === null
      ? siblingsQuery.is('parent_id', null)
      : siblingsQuery.eq('parent_id', target.parent_id)

  const { data: siblings } = await siblingsQuery
  if (!siblings) return { ok: false, error: '형제 카테고리를 불러오지 못했습니다.' }

  const idx = siblings.findIndex((s) => s.id === id)
  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || neighborIdx < 0 || neighborIdx >= siblings.length) {
    return { ok: true }
  }

  const me = siblings[idx]
  const neighbor = siblings[neighborIdx]

  const { error: e1 } = await guard.supabase
    .from('categories')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', me.id)
  if (e1) return { ok: false, error: e1.message }

  const { error: e2 } = await guard.supabase
    .from('categories')
    .update({ sort_order: me.sort_order })
    .eq('id', neighbor.id)
  if (e2) return { ok: false, error: e2.message }

  revalidateAll()
  return { ok: true }
}
