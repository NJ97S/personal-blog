import type { ComponentPropsWithoutRef } from 'react'

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'type'>

export default function PasswordInput(props: Props) {
  return (
    <input
      {...props}
      type="text"
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      className="w-full rounded-sm border border-craft-200 dark:border-ink-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-craft-400"
    />
  )
}
