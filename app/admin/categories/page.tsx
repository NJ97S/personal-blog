import { fetchCategoryTree } from '@/lib/categories'
import Layout from '@/components/Layout'
import CategoryAdmin from './CategoryAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const tree = await fetchCategoryTree()
  return (
    <Layout>
      <h1 className="text-2xl font-serif font-bold mb-6">카테고리 관리</h1>
      <CategoryAdmin tree={tree} />
    </Layout>
  )
}
