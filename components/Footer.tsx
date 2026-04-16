export default function Footer() {
  return (
    <footer className="border-t border-craft-200 dark:border-ink-600 mt-20">
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-ink-400">
        <p>© {new Date().getFullYear()} 기록. All rights reserved.</p>
      </div>
    </footer>
  )
}
