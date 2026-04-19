import Header from './Header'
import Footer from './Footer'
import CategorySidebar from './CategorySidebar'
import SideWidgets from './SideWidgets'

export default function Layout({
  children,
  rightAside,
}: {
  children: React.ReactNode
  rightAside?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8
                   grid gap-6
                   grid-cols-1
                   md:grid-cols-[260px_minmax(0,1fr)]
                   lg:grid-cols-[260px_minmax(0,1fr)_260px]"
      >
        <aside className="hidden md:block">
          <CategorySidebar />
        </aside>
        <main className="min-w-0">{children}</main>
        <aside className="hidden lg:block">
          {rightAside ?? <SideWidgets />}
        </aside>
      </div>
      <Footer />
    </div>
  )
}
