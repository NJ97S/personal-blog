const CATEGORY_DEFAULT_THUMBNAILS_BY_SLUG: Readonly<Record<string, string>> = {
  translation: '/images/category-thumbnails/translation.png',
  'web-trends': '/images/category-thumbnails/web-trends.png',
  'ai-trends': '/images/category-thumbnails/ai-trends.png',
}

/**
 * 글에 직접 지정한 썸네일을 우선하고, 없으면 가장 가까운 상위 카테고리의
 * 기본 썸네일을 사용합니다.
 */
export function resolvePostThumbnail(
  coverImage: string | null | undefined,
  categoryPath: string[] | null | undefined,
): string | null {
  if (coverImage) return coverImage
  if (!categoryPath?.length) return null

  for (let index = categoryPath.length - 1; index >= 0; index -= 1) {
    const thumbnail = CATEGORY_DEFAULT_THUMBNAILS_BY_SLUG[categoryPath[index]]
    if (thumbnail) return thumbnail
  }

  return null
}
