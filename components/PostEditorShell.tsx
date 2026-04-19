type Props = {
  children: React.ReactNode
  actions: React.ReactNode
}

export default function PostEditorShell({ children, actions }: Props) {
  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 py-10 pb-32">{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-craft-200 dark:border-ink-600 bg-craft-50/95 dark:bg-ink-900/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-3 flex items-center justify-between gap-3">
          {actions}
        </div>
      </div>
    </>
  )
}
