import Image from 'next/image'
import { Folder, Mail } from 'lucide-react'
import { fetchCategoryTree } from '@/lib/categories'
import CategoryTree from './CategoryTree'

export default async function CategorySidebar() {
  const tree = await fetchCategoryTree()

  return (
    <div className="space-y-4 sticky top-20">
      <div className="craft-card p-4">
        <div className="flex items-start gap-3">
          <Image
            src="/profile.jpeg"
            alt="프로필"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
            priority
          />
          <div className="flex min-w-0 flex-col gap-1.5 text-sm">
            <a
              href="https://github.com/NJ97S"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub 프로필 열기"
              className="flex items-center gap-2 text-ink-600 hover:text-ink-900 dark:text-craft-100 dark:hover:text-craft-50"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 shrink-0"
              >
                <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.086 3.292 9.387 7.862 10.908.574.107.786-.25.786-.553 0-.273-.011-1.177-.016-2.133-3.2.695-3.875-1.363-3.875-1.363-.523-1.33-1.278-1.684-1.278-1.684-1.045-.714.079-.699.079-.699 1.155.082 1.763 1.186 1.763 1.186 1.028 1.76 2.696 1.252 3.355.957.102-.744.402-1.252.73-1.54-2.555-.291-5.242-1.278-5.242-5.688 0-1.257.45-2.285 1.186-3.09-.12-.29-.514-1.463.112-3.05 0 0 .966-.31 3.166 1.18a11.02 11.02 0 0 1 2.881-.387c.978.004 1.964.132 2.882.387 2.199-1.49 3.163-1.18 3.163-1.18.628 1.587.234 2.76.115 3.05.738.805 1.184 1.833 1.184 3.09 0 4.421-2.691 5.394-5.255 5.68.413.356.78 1.06.78 2.137 0 1.544-.014 2.787-.014 3.166 0 .306.208.665.79.552C20.215 21.383 23.5 17.084 23.5 12 23.5 5.648 18.352.5 12 .5Z" />
              </svg>
              <span className="break-all hover:underline underline-offset-4">NJ97S</span>
            </a>
            <a
              href="mailto:skawn1228@gmail.com"
              aria-label="이메일 보내기"
              className="flex items-center gap-2 text-ink-600 hover:text-ink-900 dark:text-craft-100 dark:hover:text-craft-50"
            >
              <Mail aria-hidden className="h-4 w-4 shrink-0" />
              <span className="break-all hover:underline underline-offset-4">
                skawn1228@gmail.com
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="craft-card p-4">
        <h2 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
          <Folder aria-hidden className="h-4 w-4 text-ink-500 dark:text-craft-200" />
          <span>카테고리</span>
        </h2>
        <CategoryTree nodes={tree} />
      </div>
    </div>
  )
}
