import ThemeToggle from './ThemeToggle'
import CategoryDrawer from './CategoryDrawer'
import Logo from './Logo'
import { fetchCategoryTree } from '@/lib/categories'

export default async function Header() {
  const tree = await fetchCategoryTree()
  return (
    <header className="border-b border-craft-200 dark:border-ink-600 bg-craft-50/80 dark:bg-ink-900/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-[1440px] px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CategoryDrawer tree={tree} />
          <Logo />
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
