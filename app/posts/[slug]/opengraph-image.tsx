import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  // .single()은 0행이면 에러를 throw하지만 OG 이미지는 폴백 텍스트로 처리하면 됩니다.
  // .maybeSingle()로 변경해 존재하지 않는 슬러그에서도 안정적으로 폴백 이미지를 반환합니다.
  let slug = params.slug
  try {
    slug = decodeURIComponent(params.slug)
  } catch {
    // 잘못 인코딩된 슬러그는 원본 그대로 사용합니다.
  }
  const { data: post } = await supabase
    .from('posts')
    .select('title, created_at')
    .eq('slug', slug)
    .eq('visibility', 'public')
    .maybeSingle()

  const title = post?.title ?? 'ShyLog'
  const date = post?.created_at
    ? new Date(post.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
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
        <div style={{ fontSize: 28, color: '#7a6a5a' }}>ShyLog — 개인 기술 블로그</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 24, color: '#7a6a5a' }}>{date}</div>
      </div>
    ),
    { ...size },
  )
}
