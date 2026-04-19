'use client'

type Props = {
  name?: string
  defaultValue?: string
  required?: boolean
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  placeholder?: string
}

export default function TitleInput({
  name = 'title',
  defaultValue,
  required,
  onBlur,
  placeholder = '제목을 입력하세요',
}: Props) {
  return (
    <input
      type="text"
      name={name}
      defaultValue={defaultValue}
      required={required}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label="제목"
      className="w-full bg-transparent border-0 border-b border-craft-200 dark:border-ink-600 focus:border-ink-900 dark:focus:border-craft-50 text-4xl font-serif font-bold py-3 outline-none placeholder:text-craft-300 dark:placeholder:text-ink-600 transition-colors"
    />
  )
}
