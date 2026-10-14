import BlogViewStats from '@/components/BlogViewStats'

export default function Footer() {
  return (
    <footer className="border-t border-craft-200 dark:border-ink-600 mt-20">
      <div className="mx-auto max-w-[1440px] px-4 py-8 text-sm text-ink-400 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden lg:block">
          <BlogViewStats />
        </div>
        <p>© {new Date().getFullYear()} ShyLog. All rights reserved.</p>
      </div>
    </footer>
  )
}
