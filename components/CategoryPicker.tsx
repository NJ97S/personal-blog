import type { CategoryNode } from '@/lib/categories'
import { walkTree } from '@/lib/categories'

type Props = {
  categories: CategoryNode[]
  defaultValue?: string | null
}

function labelFor(node: CategoryNode, byId: Map<string, CategoryNode>): string {
  const parts: string[] = [node.name]
  let parent = node.parent_id ? byId.get(node.parent_id) : undefined
  while (parent) {
    parts.unshift(parent.name)
    parent = parent.parent_id ? byId.get(parent.parent_id) : undefined
  }
  return parts.join(' / ')
}

export default function CategoryPicker({ categories, defaultValue }: Props) {
  const flat = walkTree(categories)
  const byId = new Map(flat.map((n) => [n.id, n] as const))
  const options = flat
    .map((n) => ({ id: n.id, label: labelFor(n, byId) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div>
      <label htmlFor="categoryId" className="block text-sm mb-1">
        카테고리 (선택)
      </label>
      <select
        id="categoryId"
        name="categoryId"
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
      >
        <option value="">— 미지정 —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
