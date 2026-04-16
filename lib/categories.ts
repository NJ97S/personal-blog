import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type CategoryRow = {
  id: string
  slug: string
  name: string
  parent_id: string | null
  sort_order: number
}

export type CategoryNode = CategoryRow & {
  children: CategoryNode[]
  selfPostCount: number
  postCount: number
  path: string[]
}

function buildTree(
  rows: CategoryRow[],
  counts: Map<string, number>,
): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  for (const r of rows) {
    byId.set(r.id, {
      ...r,
      children: [],
      selfPostCount: counts.get(r.id) ?? 0,
      postCount: counts.get(r.id) ?? 0,
      path: [],
    })
  }

  const roots: CategoryNode[] = []
  Array.from(byId.values()).forEach((node) => {
    if (node.parent_id) {
      const parent = byId.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)

  const assignPathAndCount = (node: CategoryNode, parentPath: string[]) => {
    node.path = [...parentPath, node.slug]
    let total = node.selfPostCount
    for (const child of node.children) {
      assignPathAndCount(child, node.path)
      total += child.postCount
    }
    node.postCount = total
  }
  roots.forEach((n) => assignPathAndCount(n, []))

  return roots
}

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

export function collectDescendantIds(node: CategoryNode): string[] {
  const ids: string[] = [node.id]
  const walk = (n: CategoryNode) => {
    for (const child of n.children) {
      ids.push(child.id)
      walk(child)
    }
  }
  walk(node)
  return ids
}

export function walkTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (n: CategoryNode) => {
    out.push(n)
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}
