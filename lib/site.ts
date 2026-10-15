export const site = {
  name: 'ShyLog',
  title: 'ShyLog — Soshy의 개인 기술 블로그',
  description: 'ShyLog는 Soshy가 직접 만들고 운영하는 개인 기술 블로그입니다. 개발하며 배운 내용과 경험을 기록합니다.',
  // 경로를 붙이는 모든 곳에서 슬래시가 중복되지 않도록 끝 슬래시를 제거합니다.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shylog.com').replace(/\/+$/, ''),
  locale: 'ko_KR',
  author: {
    name: 'Soshy',
    url: 'https://github.com/NJ97S',
  },
}

// 홈과 글에서 같은 @id를 사용해 운영자와 작성자가 동일 인물임을 명시합니다.
export const authorSchema = {
  '@type': 'Person',
  '@id': new URL('/#soshy', site.url).href,
  name: site.author.name,
  url: site.author.url,
  sameAs: [site.author.url],
}
