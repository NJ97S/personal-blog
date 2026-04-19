type Props = {
  label?: string
  fullHeight?: boolean
}

export default function LoadingSpinner({
  label = '불러오는 중…',
  fullHeight = true,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${
        fullHeight ? 'min-h-[60vh]' : 'py-12'
      }`}
    >
      <div aria-hidden className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-craft-200/70 dark:border-ink-600/70" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-craft-400 dark:border-t-craft-200 animate-spin" />
      </div>
      {label && (
        <p className="text-xs font-mono tracking-wide text-ink-400 dark:text-craft-200">
          {label}
        </p>
      )}
      <span className="sr-only">불러오는 중</span>
    </div>
  )
}
