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

export function buildTree(
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
