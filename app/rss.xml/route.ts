import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { site } from '@/lib/site'

export const revalidate = 600

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const supabase = createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, title, excerpt, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)

  const items = (posts ?? [])
    .map((p) => {
      const url = `${site.url}/posts/${encodeURI(p.slug)}`
      return `    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt ?? ''}]]></description>
    </item>`
    })
    .join('\n')

  const lastBuildDate =
    posts && posts.length > 0
      ? new Date(posts[0].created_at).toUTCString()
      : new Date().toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.name)}</title>
    <link>${site.url}</link>
    <description>${escapeXml(site.description)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
    },
  })
}
