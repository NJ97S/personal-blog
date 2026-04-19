import CategoryPicker from '@/components/CategoryPicker'
import { fetchCategoryTree } from '@/lib/categories'
import NewPostForm from './NewPostForm'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const tree = await fetchCategoryTree()
  return (
    <NewPostForm
      categoryPicker={<CategoryPicker categories={tree} />}
    />
  )
}
