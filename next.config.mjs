/** @type {import('next').NextConfig} */

// 인라인 테마 스크립트(app/layout.tsx)와 Tailwind 인젝션 스타일 때문에
// 'unsafe-inline'을 허용합니다. 추후 nonce 전환을 검토할 수 있습니다.
// img-src는 next/image 옵티마이저가 same-origin으로 서빙하므로 self + supabase + data/blob 만 허용.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "media-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig = {
  images: {
    // SSRF 방지를 위해 신뢰 호스트만 명시. Supabase Storage 공개 URL은 `*.supabase.co`.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
    ]
  },
}

export default nextConfig
