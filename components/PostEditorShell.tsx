type Props = {
  children: React.ReactNode
  actions: React.ReactNode
}

export default function PostEditorShell({ children, actions }: Props) {
  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-[calc(104px+env(safe-area-inset-bottom))] sm:pt-10 sm:pb-[96px]">
        {children}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-craft-200 bg-craft-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-600 dark:bg-ink-900/95">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3 sm:flex-nowrap sm:gap-3">
          {actions}
        </div>
      </div>
    </>
  )
}
