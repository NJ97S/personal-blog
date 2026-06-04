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

// CDATA 종료 시퀀스(`]]>`)가 본문에 들어오면 CDATA 블록을 조기 종료시켜
// XML 파서를 깨뜨릴 수 있습니다. 종료 시퀀스만 분할하여 의미는 보존하면서
// 내부 데이터가 CDATA를 빠져나가지 못하도록 만듭니다.
function escapeCdata(input: string): string {
  return input.replace(/]]>/g, ']]]]><![CDATA[>')
}

export async function GET() {
  const supabase = createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, title, excerpt, created_at')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(20)

  const items = (posts ?? [])
    .map((p) => {
      const url = `${site.url}/posts/${encodeURI(p.slug)}`
      return `    <item>
      <title><![CDATA[${escapeCdata(p.title)}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${escapeCdata(p.excerpt ?? '')}]]></description>
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
