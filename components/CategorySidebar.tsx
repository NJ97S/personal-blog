import { fetchCategoryTree } from '@/lib/categories'
import CategoryTree from './CategoryTree'

export default async function CategorySidebar() {
  const tree = await fetchCategoryTree()

  return (
    <div className="space-y-4 sticky top-20">
      <div className="craft-card p-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="h-10 w-10 rounded-full bg-craft-200 dark:bg-ink-600 flex items-center justify-center font-serif font-bold text-ink-800 dark:text-craft-50"
          >
            記
          </div>
          <div>
            <p className="font-serif font-bold text-sm">ShyLog</p>
            <p className="text-xs text-ink-400">종이 위에 남기는 기술 노트</p>
          </div>
        </div>
      </div>

      <div className="craft-card p-4">
        <h2 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
          <span aria-hidden>📚</span>
          <span>카테고리</span>
        </h2>
        <CategoryTree nodes={tree} />
      </div>
    </div>
  )
}
