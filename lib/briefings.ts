import { collectDescendantIds, walkTree, type CategoryNode } from '@/lib/category-tree'

export const BRIEFING_PREVIEW_SIZE = 3

export function getBriefingCategories(tree: CategoryNode[]) {
  const root = walkTree(tree).find((category) => category.slug === 'ai-briefing')
  const categories = root ? walkTree([root]) : []

  return {
    web: categories.find((category) => category.slug === 'web-trends'),
    ai: categories.find((category) => category.slug === 'ai-trends'),
    excludedIds: root ? collectDescendantIds(root) : [],
  }
}
