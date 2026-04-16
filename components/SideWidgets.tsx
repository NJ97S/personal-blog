import SearchBox from './widgets/SearchBox'
import PopularPosts from './widgets/PopularPosts'
import RecentComments from './widgets/RecentComments'
import RecentPosts from './widgets/RecentPosts'

export default function SideWidgets() {
  return (
    <div className="space-y-4 sticky top-20">
      <SearchBox />
      <PopularPosts />
      <RecentPosts />
      <RecentComments />
    </div>
  )
}
