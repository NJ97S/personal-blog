import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('title, created_at')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  const title = post?.title ?? '기록'
  const date = post?.created_at
    ? new Date(post.created_at).toLocaleDateString('ko-KR')
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fdf8f0',
          color: '#1a1410',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'serif',
        }}
      >
        <div style={{ fontSize: 28, color: '#7a6a5a' }}>기록 — 개인 기술 블로그</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 24, color: '#7a6a5a' }}>{date}</div>
      </div>
    ),
    { ...size },
  )
}
