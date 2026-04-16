'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { CategoryNode } from '@/lib/categories'

type Props = {
  nodes: CategoryNode[]
  onNavigate?: () => void
}

export default function CategoryTree({ nodes, onNavigate }: Props) {
  const pathname = usePathname()
  const activePath = useMemo(() => {
    const m = pathname?.match(/^\/categories\/(.+)$/)
    if (!m) return [] as string[]
    return m[1].split('/').map((s) => decodeURIComponent(s))
  }, [pathname])

  return (
    <ul className="space-y-1 text-sm">
      <li>
        <Link
          href="/"
          onClick={onNavigate}
          className={`block px-2 py-1 rounded-sm hover:bg-craft-100 dark:hover:bg-ink-800/60 ${
            pathname === '/' ? 'font-bold text-ink-900 dark:text-craft-50' : 'text-ink-600 dark:text-craft-100'
          }`}
        >
          전체 글
        </Link>
      </li>
      {nodes.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          activePath={activePath}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  )
}

function TreeNode({
  node,
  depth,
  activePath,
  onNavigate,
}: {
  node: CategoryNode
  depth: number
  activePath: string[]
  onNavigate?: () => void
}) {
  const isOnActivePath = activePath[depth] === node.slug
  const isExactActive = isOnActivePath && activePath.length === depth + 1
  const [open, setOpen] = useState(isOnActivePath || depth === 0)
  const hasChildren = node.children.length > 0
  const href = `/categories/${node.path.map(encodeURIComponent).join('/')}`

  return (
    <li>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? '접기' : '펼치기'}
            className="w-5 text-xs text-ink-400 hover:text-ink-900 dark:hover:text-craft-50"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" aria-hidden />
        )}
        <Link
          href={href}
          onClick={onNavigate}
          className={`flex-1 flex items-center justify-between gap-2 px-2 py-1 rounded-sm hover:bg-craft-100 dark:hover:bg-ink-800/60 ${
            isExactActive
              ? 'font-bold text-ink-900 dark:text-craft-50'
              : isOnActivePath
                ? 'text-ink-900 dark:text-craft-50'
                : 'text-ink-600 dark:text-craft-100'
          }`}
        >
          <span className="truncate">{node.name}</span>
          <span className="text-xs font-mono text-ink-400 shrink-0">
            ({node.postCount})
          </span>
        </Link>
      </div>
      {hasChildren && open && (
        <ul className="ml-3 border-l border-craft-200 dark:border-ink-600 pl-2 mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

