import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'ShyLog — 개발 블로그'

export default function OgImage() {
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
          justifyContent: 'center',
          padding: 96,
          fontFamily: 'serif',
        }}
      >
        <div style={{ fontSize: 144, fontWeight: 700, letterSpacing: '-0.02em' }}>
          ShyLog
        </div>
        <div style={{ fontSize: 40, color: '#7a6a5a', marginTop: 24 }}>
          Shylog: 개발 블로그
        </div>
      </div>
    ),
    { ...size },
  )
}
