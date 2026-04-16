'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    router.replace('/admin/posts')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="craft-card w-full max-w-sm p-6 space-y-4">
        <h1 className="text-xl font-serif font-bold">관리자 로그인</h1>

        <div>
          <label htmlFor="email" className="block text-sm mb-1">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm mb-1">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full craft-card px-4 py-2 text-sm bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600 disabled:opacity-50"
        >
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  )
}
