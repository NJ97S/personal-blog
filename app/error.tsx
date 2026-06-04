'use client'

import { useEffect } from 'react'

// App Router의 세그먼트 에러 바운더리. 'use client' 가 강제됩니다(공식 가이드).
//
// 주의: 이 파일은 클라이언트 번들에 들어가므로 Server Component(예: lib/supabase/server.ts
// 의 createClient는 next/headers를 import)에 의존하는 컴포넌트(Layout/Header 등)를
// 끌어오면 빌드가 실패합니다. 따라서 마크업은 의도적으로 의존성 없이 직접 작성합니다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // digest는 서버 로그와 매칭되는 식별자. 사용자에게는 노출하지 않습니다.
    console.error('[app error]', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-lg border border-craft-200 dark:border-ink-600 bg-craft-50 dark:bg-ink-900 p-8 text-center space-y-4 shadow-sm">
        <h1 className="text-2xl font-serif font-bold">문제가 발생했습니다</h1>
        <p className="text-ink-400">
          페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-sm border border-ink-800 dark:border-craft-50 bg-ink-800 dark:bg-craft-50 px-4 py-1.5 text-sm text-craft-50 dark:text-ink-900 hover:bg-ink-600 dark:hover:bg-craft-200"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="text-sm underline text-ink-500 hover:text-ink-900 dark:hover:text-craft-50"
          >
            홈으로
          </a>
        </div>
      </section>
    </main>
  )
}
