# 작성 화면 ↔ 발행 화면 렌더링 통일 (MarkdownView 추출) (2026-05-09)

## 0. 요약

- **목표**: 어드민 에디터 라이브 프리뷰가 실제 발행된 글 페이지와 **글자 그대로** 같은 결과를 그리도록 만든다.
- **계기**: GFM(테이블/취소선/체크리스트), 코드 하이라이팅, 헤딩 ID 등 **에디터 미리보기엔 안 나오거나 다르게 나오던 마크업**이 실제 글 페이지에선 다르게 렌더되어 작성 시 결과를 신뢰할 수 없었음.
- **방식**: `react-markdown` + 동일한 remark/rehype 플러그인 세트를 **하나의 공유 컴포넌트(`MarkdownView`)**로 추출해 발행 페이지와 에디터 프리뷰 양쪽이 같은 렌더러를 호출하도록 통일.
- **결정 사항**:
  - 공유 컴포넌트 이름: `components/MarkdownView.tsx` (서버/클라이언트 양쪽 호환)
  - 에디터 프리뷰는 `@uiw/react-md-editor`의 `components.preview` 슬롯에 `MarkdownView`를 주입 (preview 자체를 교체)
  - 컴팩트 사이징 CSS 셀렉터를 `.wmde-markdown` → `.craft-prose-compact`로 이전(공유 컴포넌트가 클래스를 직접 부여)
  - 어드민 라우트 클라이언트 번들 +148 kB (highlight.js + plugin chain) — 비공개 작성자 전용이라 허용

---

## 1. 배경 — 왜 다르게 보였는가

`@uiw/react-md-editor`는 내부적으로 `@uiw/react-markdown-preview`를 프리뷰 패널로 쓴다. 둘 다 `react-markdown` 기반이지만 **기본 플러그인 세트가 우리 발행 페이지와 다르다**:

| 기능 | 발행 페이지(`app/posts/[slug]/page.tsx`) | 에디터 프리뷰(이전) |
|------|------------------------------------------|---------------------|
| GFM 테이블·체크리스트·취소선·자동링크 | `remarkGfm` ✅ | ❌ (없음) |
| 줄바꿈 1줄 = `<br>` | `remarkBreaks` ✅ | `remarkBreaks` ✅ |
| Raw HTML 허용 | `rehypeRaw` ✅ | (preview 라이브러리 기본값에 포함) |
| 헤딩에 `id` 부여 (앵커/ToC) | `rehypeSlug` ✅ | ❌ |
| 코드 하이라이트 | `rehypeHighlight` (highlight.js) ✅ | `@uiw/react-markdown-preview` 내장 (다른 하이라이터·다른 클래스) |
| Sanitize 정책 | 커스텀 `sanitizeSchema` (헤딩 id, hljs class 허용) | preview 라이브러리 기본값 |

이 표만 봐도 GFM 표/체크리스트 같은 굵직한 기능은 **에디터에선 그냥 텍스트로 보이다가** 발행 후엔 표로 변환되는 식의 어긋남이 발생할 수 있다. 코드 하이라이트는 색이 다른 정도였지만, GFM은 “있다/없다”가 갈리는 차이라 작성자가 결과를 미리 가늠할 수 없었다.

### 왜 이번에 손댔나
- `references/스크린샷 2026-05-09 오전 12.09.26.png`에서 같은 본문이 좌(편집)·우(프리뷰)에서 다르게 보이는 케이스를 사용자가 보고함
- 이 블로그는 1인 작성자 + 마크다운 직편집이라 “WYSIWYG”의 가장 중요한 가치가 “쓴 그대로 나가야 한다”

### 비채택 옵션
| 옵션 | 채택 안 한 이유 |
|------|-----------------|
| ① `previewOptions`에 `remarkPlugins`/`rehypePlugins` 더 넣기 | `@uiw/react-markdown-preview`는 자체 기본 플러그인을 가지고 있고, 사용자 지정 플러그인은 **병합**된다. 동일 플러그인이 두 번 실행되거나(`rehypeRaw` 등), 다른 코드 하이라이터가 충돌하는 위험. 우리 sanitize 스키마가 라이브러리 기본 sanitize와 어떻게 상호작용하는지도 검증 필요. fragile. |
| ② `pluginsFilter`로 기본 플러그인을 모두 제거 + 우리 것 추가 | 가능은 한데, 라이브러리 내부 디테일(이름·순서·필터링 시점)에 의존. 라이브러리 업그레이드 시 깨짐. |
| ③ **공유 컴포넌트 + `components.preview` 슬롯 교체 (선택)** | 프리뷰 패널 자체를 우리 컴포넌트로 대체. 라이브러리 내부 플러그인은 아예 안 돈다 → 100% 일치 보장. 라이브러리 업그레이드 영향도 최소. |

---

## 2. 아키텍처 개요

```
[작성 흐름]
  관리자 → /admin/posts/[id]/edit
            └─> <MarkdownEditor> (Client Component)
                  └─> <MDEditor preview="live"
                          components={{
                            preview: (source) => <MarkdownView content={source} compact />
                          }}/>
                                  └─> 라이브러리 자체 프리뷰 회피, 우리 렌더러로 대체

[발행 흐름]
  사용자 → /posts/<slug>
            └─> <MarkdownView content={post.content} /> (Server Component 컨텍스트)

→ 두 경로 모두 같은 컴포넌트 호출 → 같은 플러그인 세트 → 같은 출력
```

### 컴포넌트 경계

| 파일 | 역할 | 경계 |
|------|------|------|
| `components/MarkdownView.tsx` | `<ReactMarkdown>` + 플러그인 + `craft-prose` wrapper | **'use client' 미부여** — 서버/클라이언트 어디서 import해도 동작. 발행 페이지(서버)와 에디터(클라이언트)에서 모두 사용 |
| `components/MarkdownEditor.tsx` | MDEditor 호스팅 + `components.preview` 슬롯 교체 | `'use client'` |
| `app/posts/[slug]/page.tsx` | `<MarkdownView>` 1줄 호출로 단순화 | Server Component |
| `app/globals.css` | `.craft-prose-compact` 컴팩트 룰 | 전역 |

**`'use client'` 미부여 결정 이유**: `react-markdown`은 React Server Components와 호환된다(브라우저 API 미사용). 클라이언트 컴포넌트(MarkdownEditor)에서 import하면 자동으로 클라이언트 번들에 포함되고, 서버 컴포넌트(post/[slug])에서 import하면 서버에서 실행된다. 한 컴포넌트로 두 경로 모두 커버.

---

## 3. 변경 대상 파일

### 신규
| 파일 | 역할 |
|------|------|
| `components/MarkdownView.tsx` | 공유 마크다운 렌더러 — 플러그인·sanitize 스키마 캡슐화 |

### 수정
| 파일 | 변경 |
|------|------|
| `app/posts/[slug]/page.tsx` | 인라인 `ReactMarkdown` 호출과 `sanitizeSchema` 정의를 제거하고 `<MarkdownView content={post.content} />` 한 줄로 대체 |
| `components/MarkdownEditor.tsx` | `previewOptions={{ remarkPlugins }}` 제거. `components.preview`로 `MarkdownView` 주입. `@uiw/react-markdown-preview/markdown.css` import도 제거(이제 우리가 직접 그리므로 불필요) |
| `app/globals.css` | 프리뷰 컴팩트 사이징 셀렉터를 `.w-md-editor-preview .wmde-markdown` → `.craft-prose-compact`로 이전 |

---

## 4. 상세 구현

### 4.1 `components/MarkdownView.tsx` — 공유 렌더러

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { PluggableList } from 'unified'

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-[a-z0-9-]+$/, /^hljs(-[a-z0-9-]+)?$/],
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', /^hljs(-[a-z0-9-]+)?$/],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      ['className', /^hljs(-[a-z0-9-]+)?$/],
    ],
  },
}

const remarkPlugins: PluggableList = [remarkGfm, remarkBreaks]
const rehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeSlug,
  rehypeHighlight,
  [rehypeSanitize, sanitizeSchema],
]

type Props = {
  content: string
  compact?: boolean
  className?: string
}

export default function MarkdownView({ content, compact, className }: Props) {
  const wrapperClass = [
    'craft-prose prose-neutral dark:prose-invert',
    compact ? 'craft-prose-compact' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClass}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**핵심 포인트**
- **플러그인 모듈 상수로 추출**: `remarkPlugins`/`rehypePlugins`를 컴포넌트 바깥 모듈 스코프 상수로 빼서 매 렌더마다 새 배열을 만들지 않음. 미세하지만 라이브 프리뷰처럼 키 입력마다 다시 그리는 환경에서 의미 있음.
- **`PluggableList` 타입 명시**: 처음엔 inline 배열이라 추론이 됐는데, 모듈 상수로 빼면 `as const`로 좁혀지면서 `react-markdown`의 props 타입과 안 맞음 → `PluggableList`로 정확히 타입 부여(§5 시행착오 참고).
- **`compact` prop**: 에디터 프리뷰는 작은 텍스트 사이즈가 어울리므로 `craft-prose-compact` 클래스를 추가로 부여. 발행 페이지는 부여하지 않음.
- **sanitize 스키마는 컴포넌트 내부에 캡슐화**: 헤딩 `id`, hljs 관련 className 화이트리스트. 두 사용처(서버·클라이언트)가 같은 스키마를 공유하므로 한쪽만 보안 강화/완화되는 사고 방지.

### 4.2 `app/posts/[slug]/page.tsx` — 호출부 단순화

```diff
-import ReactMarkdown from 'react-markdown'
-import remarkGfm from 'remark-gfm'
-import remarkBreaks from 'remark-breaks'
-import rehypeRaw from 'rehype-raw'
-import rehypeHighlight from 'rehype-highlight'
-import rehypeSlug from 'rehype-slug'
-import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
+import MarkdownView from '@/components/MarkdownView'

-const sanitizeSchema = { ... 약 25줄 ... }
```

본문 렌더링부:

```diff
-<div className="craft-prose prose-neutral dark:prose-invert">
-  <ReactMarkdown
-    remarkPlugins={[remarkGfm, remarkBreaks]}
-    rehypePlugins={[
-      rehypeRaw,
-      rehypeSlug,
-      rehypeHighlight,
-      [rehypeSanitize, sanitizeSchema],
-    ]}
-  >
-    {post.content}
-  </ReactMarkdown>
-</div>
+<MarkdownView content={post.content} />
```

페이지 컴포넌트가 짧아지고, 마크다운 렌더링 정책 변화가 한 곳(`MarkdownView`)에서만 일어나도록 단일화됨.

### 4.3 `components/MarkdownEditor.tsx` — 프리뷰 슬롯 교체

```diff
 'use client'

 import dynamic from 'next/dynamic'
 import { useEffect, useState } from 'react'
-import remarkBreaks from 'remark-breaks'
+import MarkdownView from './MarkdownView'
 import '@uiw/react-md-editor/markdown-editor.css'
-import '@uiw/react-markdown-preview/markdown.css'

 const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ... })

   return (
     <div data-color-mode={colorMode}>
       <input type="hidden" name={name} value={value} readOnly />
       <MDEditor
         value={value}
         onChange={(val) => setValue(val ?? '')}
         height={height}
         preview="live"
-        previewOptions={{ remarkPlugins: [remarkBreaks] }}
+        components={{
+          preview: (source) => <MarkdownView content={source} compact />,
+        }}
       />
     </div>
   )
```

**`components.preview` API 활용**
- `@uiw/react-md-editor`는 `components.preview: (source, state, dispatch) => ReactElement` 슬롯을 노출 (출처: `node_modules/@uiw/react-md-editor/lib/Types.d.ts`)
- 이 슬롯을 우리가 채우면 라이브러리 내장 프리뷰는 호출되지 않음 → `@uiw/react-markdown-preview`의 기본 플러그인 체인 자체가 안 돌고, 우리 `MarkdownView`의 출력만 보임
- 이로써 라이브러리 업그레이드로 기본 플러그인이 바뀌어도 프리뷰는 영향을 받지 않는다

### 4.4 `app/globals.css` — 컴팩트 셀렉터 이전

```diff
-.w-md-editor-preview .wmde-markdown { font-size: 14px !important; ... }
-.w-md-editor-preview .wmde-markdown h1 { font-size: 1.6em !important; }
+.craft-prose-compact { font-size: 14px !important; ... }
+.craft-prose-compact h1 { font-size: 1.6em !important; }
```

라이브러리 내장 프리뷰가 더는 안 도니까 `.wmde-markdown` 클래스가 DOM에 없다 → 셀렉터를 `.craft-prose-compact`로 변경. `MarkdownView`가 `compact` 시 직접 그 클래스를 부여하므로 동일한 컴팩트 외관이 유지됨.

---

## 5. 시행착오 — 모듈 상수로 빼니 타입이 흔들렸다

처음엔 빠르게 `as const`로 떨어진 배열을 그대로 ReactMarkdown에 넘기려 했음:

```ts
const rehypePlugins = [
  rehypeRaw,
  rehypeSlug,
  rehypeHighlight,
  [rehypeSanitize, sanitizeSchema] as const,  // ← 튜플 타입으로 좁힘
]

// JSX
<ReactMarkdown rehypePlugins={rehypePlugins} ... >
```

`tsc --noEmit`은 통과했지만 `react-markdown`의 props 타입(`PluggableList = Pluggable[]`)과 **`as const` 튜플의 readonly 속성이 충돌**해서 빌드 단계 타입 검사 또는 IDE에서 빨간 줄. 임시 회피로 `as any` + `eslint-disable next-line @typescript-eslint/no-explicit-any`를 붙였다가:

```
./components/MarkdownView.tsx
61:9  Error: Definition for rule '@typescript-eslint/no-explicit-any' was not found.
```

이 프로젝트의 ESLint 설정엔 `@typescript-eslint` 플러그인이 등록돼 있지 않다(`next/core-web-vitals` 베이스만 사용). 그래서 disable 코멘트의 룰명 자체가 unknown이라 ESLint가 에러로 떨어뜨림. 우회가 또 다른 우회를 부르는 전형적인 패턴.

**정상 해법**: `as const`를 떼고 `PluggableList` 타입을 명시적으로 부여.

```ts
import type { PluggableList } from 'unified'

const remarkPlugins: PluggableList = [remarkGfm, remarkBreaks]
const rehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeSlug,
  rehypeHighlight,
  [rehypeSanitize, sanitizeSchema],
]
```

`PluggableList`는 `Pluggable[]`이고 `Pluggable`은 `Plugin | [Plugin, ...PluginParameters]` 같은 union이라서 `[rehypeSanitize, sanitizeSchema]` 형태도 정상으로 받아들인다. 캐스트 없이 컴파일 통과 + ESLint 통과.

**교훈**: `as const`는 타입을 **좁히는** 도구이지 **확장**시키지 않는다. 라이브러리가 받는 타입이 이미 적절한 `Array<X>`라면, 변수 측에서 `as const`로 좁힐 게 아니라 라이브러리 타입을 그대로 import해서 부여하는 쪽이 맞다.

---

## 6. 부수 효과 — 어드민 라우트 번들 사이즈

`npm run build` 결과 비교:

| 라우트 | 이전 First Load JS | 이후 | 차이 |
|--------|-------------------|------|------|
| `/admin/posts/new` | 159 kB | **307 kB** | **+148 kB** |
| `/admin/posts/[id]/edit` | 169 kB | **317 kB** | **+148 kB** |
| `/posts/[slug]` (서버) | 117 kB | 117 kB | 0 |
| `/`, `/categories/[...slug]` | 105 kB | 105 kB | 0 |

증가분(+148 kB)은 어드민이 클라이언트에서 `MarkdownView`를 그리면서 함께 로드되는:
- `react-markdown` + `remark-gfm` + `remark-breaks`
- `rehype-raw`, `rehype-slug`, `rehype-sanitize`
- **`rehype-highlight` + `highlight.js`** (가장 큰 비중)

가 차지한다. 발행 페이지는 서버 렌더링이라 동일 라이브러리들이 클라이언트에 안 실린다 → 공개 사이트는 영향 0.

**허용 판단**
- 어드민은 1인 작성자 전용. 모바일에서 글 쓸 일이 거의 없고, 데스크톱에서 한 번 로드된 청크는 캐시됨.
- `highlight.js`만 따로 dynamic import로 분리하는 최적화도 가능하지만 “편집 시 코드 블록을 안 칠 수도 있다” 같은 가정이 약함. 보통 친다.
- **신뢰성(작성↔발행 동일 보장) > 어드민 번들 사이즈** — 작성자 본인의 신뢰 깨짐을 +148 kB로 사는 건 합리적.

---

## 7. 검증

### 정적 검사
- `npm run lint` ✓ 0 errors/warnings
- `npx tsc --noEmit` ✓ 0 errors
- `npm run build` ✓ "Compiled successfully", 정적 16 페이지 생성

### 수동 시나리오 (작성자가 확인하면 좋은 케이스)
1. **GFM 표** — 좌측에 파이프 표를 친다 → 우측 프리뷰가 표로 렌더링되는지(이전엔 raw 텍스트)
2. **체크리스트** — `- [ ] 할 일`, `- [x] 한 일` → 우측에 체크박스로 보이는지
3. **취소선** — `~~취소선~~` → 우측에서 취소선으로 보이는지
4. **자동링크** — 그냥 `https://example.com` 텍스트 → 클릭 가능한 링크로
5. **헤딩** — `### 제목` → 좌측에선 plain, 우측에선 `<h3 id="제목">` (개발자 도구로 id 확인). 발행 후 ToC와 앵커 동작도 동일해야 함
6. **코드 블록** — ```ts``` 블록 → 우측에 hljs 클래스 + 다크 배경(globals.css의 `github-dark.css`). 좌·우 색이 동일
7. **인용블록(callout)** — `> 인용` → 우측이 `craft-prose blockquote` 스타일(왼쪽 4px 보더 + 옅은 배경). 이전엔 react-markdown-preview 기본 스타일이라 다름
8. **다크모드 토글** — 헤더에서 다크/라이트 전환 → 에디터 프리뷰 색도 함께 전환되는지(`data-color-mode` 값은 그대로 유지)
9. **인라인 raw HTML** — `<u>밑줄</u>` 같은 허용된 태그 → 좌·우 동일하게 렌더 / `<script>` 같은 차단 태그 → 좌·우 모두 무시(sanitize 스키마 동일)

### 검증 미수행 항목
- 브라우저 실측은 작성자에게 위임 (CI 환경에 dev 서버 띄울 수 없음)
- 매우 큰 글(수천 줄) 입력 시 키 입력 지연 — react-markdown은 풀 리렌더 모델이라 큰 글에서 느려질 수 있음. 현재 글 사이즈 분포에선 문제 없을 것으로 추정. 문제 시 `useDeferredValue` 또는 debounce 적용 검토.

---

## 8. 결정 로그

| 결정 | 채택 | 사유 |
|------|------|------|
| 프리뷰 통일 방식 | `components.preview` 슬롯 교체 (옵션 ③) | 라이브러리 내장 플러그인 체인을 우회 → 100% 일치 보장. 옵션 ①(병합)은 충돌 위험, ②(필터)는 라이브러리 내부에 의존 |
| 공유 컴포넌트 위치 | `components/MarkdownView.tsx` | 발행 페이지·에디터 둘 다 `components/`에서 import — 자연스러운 위치 |
| `'use client'` 부여 | **하지 않음** | 서버·클라이언트 양쪽에서 사용해야 함. react-markdown은 양쪽 호환 |
| sanitize 스키마 위치 | `MarkdownView` 내부에 캡슐화 | 두 호출처가 같은 정책을 강제 받도록. 페이지 측에서 정의하면 한쪽만 변경되어도 들통남 |
| `compact` prop | 추가 | 에디터 프리뷰는 약간 작은 폰트가 어울림. 발행 페이지는 큰 본문 폰트 유지 |
| 컴팩트 CSS 셀렉터 | `.craft-prose-compact` | 라이브러리 클래스(`.wmde-markdown`)에 의존 안 함. wrapper 클래스를 우리가 부여 |
| 플러그인 배열 타입 | `PluggableList` 명시 | `as const` 튜플은 react-markdown props와 호환 안 됨. `any` 캐스트는 ESLint 룰 누락으로 또 다른 에러 야기 |
| 어드민 번들 +148 kB | 허용 | 작성자 신뢰성 우선. 공개 라우트는 영향 0 |
| `highlight.js` 동적 import 분리 | **하지 않음** (이번 범위 밖) | 코드 안 쓰는 글이 드묾. 필요해지면 별개 작업으로 분리 |
| `@uiw/react-markdown-preview/markdown.css` import 제거 | 제거 | 라이브러리 프리뷰를 더 안 쓰므로 해당 CSS 불필요 |
| `previewOptions={{ remarkPlugins: [remarkBreaks] }}` 제거 | 제거 | preview 슬롯 교체로 의미가 없어짐 |

---

## 9. 작업 순서 (실제)

| 단계 | 항목 |
|------|------|
| 1 | 사용자 스크린샷 확인 → 프리뷰/발행 차이 보고 |
| 2 | `MarkdownEditor.tsx`(이전) vs `app/posts/[slug]/page.tsx`의 플러그인 세트 차이 진단 |
| 3 | `@uiw/react-md-editor` Types.d.ts에서 `components.preview` 슬롯 존재 확인 |
| 4 | `components/MarkdownView.tsx` 작성 (sanitizeSchema, 플러그인, compact prop) |
| 5 | `app/posts/[slug]/page.tsx`에서 인라인 ReactMarkdown 호출 제거 → `<MarkdownView>` 한 줄 |
| 6 | `components/MarkdownEditor.tsx`에서 `components.preview` 슬롯에 `MarkdownView` 주입, `previewOptions`/`react-markdown-preview/markdown.css` 정리 |
| 7 | `app/globals.css` 컴팩트 셀렉터 `.wmde-markdown` → `.craft-prose-compact` 이전 |
| 8 | `npm run lint` 1차 실패(`@typescript-eslint/no-explicit-any` 룰 미정의) → `as const`/`any` 캐스트 제거하고 `PluggableList`로 교체 → 통과 |
| 9 | `npm run build` ✓ exit 0, 어드민 라우트 +148 kB 확인, 공개 라우트 사이즈 변화 없음 |
| 10 | 본 개발일지 작성 |

---

## 10. 후속 가능성

| 항목 | 비고 |
|------|------|
| `highlight.js` 코드 스플리팅 | dynamic import로 코드 블록을 처음 만났을 때만 로드. 어드민 진입 속도 -148 kB. 우선순위 낮음 |
| MDX 도입 | 컴포넌트를 마크다운에 직접 박을 수 있음. 현재 `<u>` 같은 raw HTML 정도면 충분 |
| 프리뷰 디바운스 | 큰 글 작성 시 키 입력 지연 발생 시. 현재 사이즈 분포에선 불필요 |
| sanitize 스키마 노출 정도 검토 | 현재 헤딩 id + hljs class만 허용. `<details>`, `<summary>`, `<kbd>` 같은 유용한 태그 추가 검토 가능 |
