import { Search } from 'lucide-react'

export default function SearchBox() {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="craft-card p-3"
    >
      <label htmlFor="search-q" className="sr-only">
        검색
      </label>
      <div className="flex items-center gap-2">
        <Search aria-hidden className="h-4 w-4 text-ink-400" />
        <input
          id="search-q"
          name="q"
          type="search"
          placeholder="검색… (#태그 가능)"
          maxLength={100}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
      </div>
    </form>
  )
}
