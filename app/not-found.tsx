import Link from 'next/link'
import Layout from '@/components/Layout'

export const metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <Layout>
      <section className="craft-card p-8 text-center space-y-4">
        <h1 className="text-2xl font-serif font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="text-ink-400">
          요청하신 주소가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link
          href="/"
          className="inline-block underline text-ink-500 hover:text-ink-900 dark:hover:text-craft-50"
        >
          홈으로 돌아가기
        </Link>
      </section>
    </Layout>
  )
}
