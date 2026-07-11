'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import type { CategoryNode } from '@/lib/category-tree'
import { collectDescendantIds, walkTree } from '@/lib/category-tree'
import {
  createCategory,
  deleteCategory,
  reorderCategory,
  updateCategory,
  type ActionState,
  type CategoryInput,
} from '@/app/actions/categories'

type ParentOption = { id: string; label: string }

type FormValues = {
  name: string
  slug: string
  parentId: string
}

function pathLabel(
  node: CategoryNode,
  byId: Map<string, CategoryNode>,
): string {
  const parts: string[] = [node.name]
  let parent = node.parent_id ? byId.get(node.parent_id) : undefined
  while (parent) {
    parts.unshift(parent.name)
    parent = parent.parent_id ? byId.get(parent.parent_id) : undefined
  }
  return parts.join(' / ')
}

function toInput({ name, slug, parentId }: FormValues): CategoryInput {
  return {
    name,
    slug,
    parentId: parentId ? parentId : null,
  }
}

export default function CategoryAdmin({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const allNodes = walkTree(tree)
  const byId = new Map(allNodes.map((n) => [n.id, n] as const))
  const allParentOptions: ParentOption[] = allNodes
    .map((n) => ({ id: n.id, label: pathLabel(n, byId) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  function parentOptionsFor(excludeId?: string): ParentOption[] {
    if (!excludeId) return allParentOptions
    const target = byId.get(excludeId)
    if (!target) return allParentOptions
    const banned = new Set(collectDescendantIds(target))
    return allParentOptions.filter((o) => !banned.has(o.id))
  }

  function handle(promise: Promise<ActionState>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await promise
      if (!res.ok) {
        setError(res.error ?? '오류가 발생했습니다.')
        return
      }
      onSuccess?.()
      router.refresh()
    })
  }

  function onDelete(node: CategoryNode) {
    const descendants = collectDescendantIds(node).length - 1
    const posts = node.postCount
    const lines = [`'${node.name}' 카테고리를 삭제하시겠습니까?`]
    if (descendants > 0)
      lines.push(`- 하위 ${descendants}개 카테고리도 함께 삭제됩니다.`)
    if (posts > 0)
      lines.push(`- 연결된 ${posts}개 글의 카테고리가 미지정으로 변경됩니다.`)
    if (!confirm(lines.join('\n'))) return
    handle(deleteCategory(node.id))
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {addOpen ? (
        <CategoryForm
          initial={{ name: '', slug: '', parentId: '' }}
          parentOptions={allParentOptions}
          pending={pending}
          submitLabel="추가"
          onCancel={() => setAddOpen(false)}
          onSubmit={(values) =>
            handle(createCategory(toInput(values)), () => setAddOpen(false))
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-craft-200 dark:border-ink-600 px-3 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
        >
          <Plus className="h-4 w-4" aria-hidden /> 새 카테고리
        </button>
      )}

      <ul className="craft-card divide-y divide-craft-200 dark:divide-ink-600">
        {tree.length === 0 && (
          <li className="p-4 text-sm text-ink-400">카테고리가 없습니다.</li>
        )}
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            editingId={editingId}
            pending={pending}
            parentOptionsFor={parentOptionsFor}
            onStartEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(values) =>
              handle(updateCategory(node.id, toInput(values)), () =>
                setEditingId(null),
              )
            }
            onReorder={(dir) => handle(reorderCategory(node.id, dir))}
            onDelete={onDelete}
            renderChild={(child, depth) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth}
                editingId={editingId}
                pending={pending}
                parentOptionsFor={parentOptionsFor}
                onStartEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(values) =>
                  handle(updateCategory(child.id, toInput(values)), () =>
                    setEditingId(null),
                  )
                }
                onReorder={(dir) => handle(reorderCategory(child.id, dir))}
                onDelete={onDelete}
                renderChild={(grand, grandDepth) => (
                  <TreeRow
                    key={grand.id}
                    node={grand}
                    depth={grandDepth}
                    editingId={editingId}
                    pending={pending}
                    parentOptionsFor={parentOptionsFor}
                    onStartEdit={setEditingId}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(values) =>
                      handle(updateCategory(grand.id, toInput(values)), () =>
                        setEditingId(null),
                      )
                    }
                    onReorder={(dir) => handle(reorderCategory(grand.id, dir))}
                    onDelete={onDelete}
                    renderChild={() => null}
                  />
                )}
              />
            )}
          />
        ))}
      </ul>
    </div>
  )
}

type TreeRowProps = {
  node: CategoryNode
  depth: number
  editingId: string | null
  pending: boolean
  parentOptionsFor: (excludeId?: string) => ParentOption[]
  onStartEdit: (id: string) => void
  onCancelEdit: () => void
  onSaveEdit: (values: FormValues) => void
  onReorder: (direction: 'up' | 'down') => void
  onDelete: (node: CategoryNode) => void
  renderChild: (child: CategoryNode, depth: number) => React.ReactNode
}

function TreeRow({
  node,
  depth,
  editingId,
  pending,
  parentOptionsFor,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReorder,
  onDelete,
  renderChild,
}: TreeRowProps) {
  const editing = editingId === node.id
  return (
    <>
      <li
        className="flex flex-wrap items-start gap-x-2 gap-y-2 px-3 py-2 md:flex-nowrap md:items-center"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        {editing ? (
          <div className="flex-1">
            <CategoryForm
              initial={{
                name: node.name,
                slug: node.slug,
                parentId: node.parent_id ?? '',
              }}
              parentOptions={parentOptionsFor(node.id)}
              pending={pending}
              submitLabel="저장"
              onCancel={onCancelEdit}
              onSubmit={onSaveEdit}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 basis-full md:basis-auto">
              <p className="break-words text-sm">
                <span className="font-bold">{node.name}</span>
                <span className="ml-2 text-xs font-mono text-ink-400">
                  /{node.slug}
                </span>
                {node.postCount > 0 && (
                  <span className="ml-2 text-xs text-ink-400">
                    ({node.postCount}개 글)
                  </span>
                )}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-ink-500 dark:text-craft-200">
              <IconButton
                aria-label="위로"
                disabled={pending}
                onClick={() => onReorder('up')}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton
                aria-label="아래로"
                disabled={pending}
                onClick={() => onReorder('down')}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton
                aria-label="편집"
                disabled={pending}
                onClick={() => onStartEdit(node.id)}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton
                aria-label="삭제"
                disabled={pending}
                onClick={() => onDelete(node)}
                className="hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </>
        )}
      </li>
      {node.children.map((child) => renderChild(child, depth + 1))}
    </>
  )
}

function IconButton({
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex h-11 w-11 items-center justify-center rounded-sm hover:bg-craft-100 dark:hover:bg-ink-800 disabled:opacity-40 md:h-7 md:w-7 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

function CategoryForm({
  initial,
  parentOptions,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: FormValues
  parentOptions: ParentOption[]
  submitLabel: string
  pending: boolean
  onSubmit: (values: FormValues) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [parentId, setParentId] = useState(initial.parentId)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name, slug, parentId })
      }}
      className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="이름"
        aria-label="카테고리 이름"
        className="rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        required
        pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
        placeholder="slug"
        aria-label="slug"
        className="rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm font-mono"
      />
      <select
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        aria-label="상위 카테고리"
        className="rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
      >
        <option value="">— 최상위 —</option>
        {parentOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-3 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200 disabled:opacity-50"
        >
          {pending ? '처리 중…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-ink-600 dark:text-craft-100 hover:text-ink-900 dark:hover:text-craft-50"
        >
          취소
        </button>
      </div>
    </form>
  )
}
