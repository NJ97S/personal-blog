export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8">
      <div className="animate-pulse grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className="hidden md:block">
          <div className="craft-card h-48 p-4" />
        </div>
        <article className="mx-auto w-full max-w-3xl space-y-5">
          <div className="h-4 w-32 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          <div className="space-y-3">
            <div className="h-10 w-5/6 rounded bg-craft-200/70 dark:bg-ink-800/70" />
            <div className="h-10 w-3/4 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-craft-200/70 dark:bg-ink-800/70" />
            <div className="h-4 w-16 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-craft-200/70 dark:bg-ink-800/70" />
            <div className="h-5 w-16 rounded-full bg-craft-200/70 dark:bg-ink-800/70" />
          </div>
          <div className="space-y-3 pt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 rounded bg-craft-200/70 dark:bg-ink-800/70"
                style={{ width: `${70 + ((i * 7) % 30)}%` }}
              />
            ))}
          </div>
        </article>
        <div className="hidden lg:block">
          <div className="craft-card h-64 p-4" />
        </div>
      </div>
    </div>
  )
}
