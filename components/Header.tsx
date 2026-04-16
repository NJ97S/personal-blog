import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="border-b border-craft-200 dark:border-ink-600">
      <div className="mx-auto max-w-4xl px-4 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-serif font-bold tracking-tight">
          기록
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline underline-offset-4">
            글
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
