export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded bg-craft-200/70 dark:bg-ink-800/70" />
            <div className="h-9 w-24 rounded bg-craft-200/70 dark:bg-ink-800/70" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="craft-card p-4 space-y-2">
              <div className="h-5 w-2/3 rounded bg-craft-200/70 dark:bg-ink-800/70" />
              <div className="h-3 w-1/2 rounded bg-craft-200/70 dark:bg-ink-800/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
