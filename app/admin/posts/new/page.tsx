import Layout from '@/components/Layout'
import CategoryPicker from '@/components/CategoryPicker'
import { fetchCategoryTree } from '@/lib/categories'
import NewPostForm from './NewPostForm'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const tree = await fetchCategoryTree()
  return (
    <Layout>
      <h1 className="text-2xl font-serif font-bold mb-6">새 글</h1>
      <NewPostForm
        categoryPicker={<CategoryPicker categories={tree} />}
      />
    </Layout>
  )
}
