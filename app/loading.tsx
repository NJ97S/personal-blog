export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          <div className="h-4 w-64 rounded bg-craft-200/70 dark:bg-ink-800/70" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_260px]">
          <div className="hidden md:block">
            <div className="craft-card h-48 p-4" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="craft-card space-y-3 p-6">
                <div className="h-5 w-2/3 rounded bg-craft-200/70 dark:bg-ink-800/70" />
                <div className="h-4 w-full rounded bg-craft-200/70 dark:bg-ink-800/70" />
                <div className="h-4 w-3/4 rounded bg-craft-200/70 dark:bg-ink-800/70" />
                <div className="flex gap-2 pt-2">
                  <div className="h-5 w-16 rounded-full bg-craft-200/70 dark:bg-ink-800/70" />
                  <div className="h-5 w-20 rounded-full bg-craft-200/70 dark:bg-ink-800/70" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="craft-card h-64 p-4" />
          </div>
        </div>
      </div>
    </div>
  )
}
