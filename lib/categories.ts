import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  buildTree,
  type CategoryNode,
  type CategoryRow,
} from './category-tree'

export type { CategoryRow, CategoryNode } from './category-tree'
export { collectDescendantIds, walkTree } from './category-tree'

export const fetchCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const supabase = createClient()
  const [catsRes, countsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, parent_id, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('category_post_counts').select('category_id, post_count'),
  ])

  const rows = (catsRes.data ?? []) as CategoryRow[]
  const counts = new Map<string, number>()
  for (const c of countsRes.data ?? []) {
    counts.set(c.category_id as string, Number(c.post_count) || 0)
  }
  return buildTree(rows, counts)
})

export async function findCategoryByPath(slugs: string[]): Promise<CategoryNode | null> {
  if (!slugs.length) return null
  const tree = await fetchCategoryTree()
  let current: CategoryNode | undefined
  let nodes = tree
  for (const slug of slugs) {
    current = nodes.find((n) => n.slug === slug)
    if (!current) return null
    nodes = current.children
  }
  return current ?? null
}
