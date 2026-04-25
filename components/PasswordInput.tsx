'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  minLength?: number
  maxLength?: number
  placeholder?: string
  autoComplete?: string
}

export default function PasswordInput(props: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 pr-10 text-sm focus:outline-none focus:border-craft-400"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-craft-50"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
