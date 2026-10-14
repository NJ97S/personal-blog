import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkCjkFriendly from 'remark-cjk-friendly/parseOnly'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { PluggableList } from 'unified'

// highlight.js 전 언어를 번들에 포함하면 ~180KB(gzip)이 클라이언트로 전달됩니다.
// 블로그에서 실제 사용하는 언어만 등록해 ~150KB 절감합니다.
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const hljsLanguages = {
  bash,
  sh: bash,
  shell,
  css,
  diff,
  dockerfile,
  go,
  ini,
  toml: ini,
  java,
  javascript,
  js: javascript,
  jsx: javascript,
  json,
  markdown,
  md: markdown,
  plaintext,
  text: plaintext,
  python,
  py: python,
  rust,
  rs: rust,
  sql,
  typescript,
  ts: typescript,
  tsx: typescript,
  xml,
  html: xml,
  yaml,
  yml: yaml,
}

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

// Local hast-shaped type — avoids depending on @types/hast for one plugin.
// Mirrors the subset of node fields we actually inspect.
type HastNode = {
  type: string
  tagName?: string
  value?: string
  position?: {
    start?: { line?: number }
    end?: { line?: number }
  }
  properties?: Record<string, unknown>
  children?: HastNode[]
}

// A standalone <br> is an explicit blank line, not a paragraph with its own
// margins. Raw HTML may leave it directly at the root (e.g. after a list).
function rehypeBlankLines() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.tagName === 'pre' || node.tagName === 'code') return
      if (node.type === 'root' && node.children) {
        node.children = node.children.map((child) =>
          child.tagName === 'br'
            ? {
                type: 'element', tagName: 'p', properties: {},
                position: child.position, children: [child],
              }
            : child,
        )
      }
      if (
        node.tagName === 'p' &&
        node.children?.some((child) => child.tagName === 'br') &&
        node.children.every((child) =>
          child.tagName === 'br' ||
          (child.type === 'text' && !child.value?.trim()),
        )
      ) {
        node.properties = { ...node.properties, className: ['markdown-blank-line'] }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

// Stamp each rendered element with the markdown source line it originates from.
// Runs *after* rehypeSanitize: hast-util-sanitize preserves node.position, so we
// can safely add the `data-line` attribute without it being stripped or needing
// a schema whitelist. The editor preview uses these anchors for scroll sync.
function rehypeSourceLine() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === 'element' && node.position?.start?.line != null) {
        node.properties = node.properties ?? {}
        node.properties.dataLine = String(node.position.start.line)
        // End line too, so the sync can interpolate *through* multi-line blocks
        // (images, code, tables, raw HTML) instead of pinning them to one anchor.
        if (node.position.end?.line != null) {
          node.properties.dataLineEnd = String(node.position.end.line)
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(walk)
    }
    walk(tree)
  }
}

// 괄호/문장 부호로 끝난 강조 뒤에 한글 조사가 붙어도 닫는 **를 인식합니다.
// 파싱 단계에서 처리해 코드/이스케이프와 원본 위치(스크롤 동기화)를 보존합니다.
const remarkPlugins: PluggableList = [remarkGfm, remarkCjkFriendly, remarkBreaks]
const rehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeSlug,
  // subset: false 로 자동 감지를 끄고, 코드 펜스에 명시된 언어만 하이라이팅합니다.
  // 명시되지 않은 코드 블록은 plain text로 렌더되어 잘못된 감지를 막습니다.
  [rehypeHighlight, { languages: hljsLanguages, subset: false, ignoreMissing: true }],
  [rehypeSanitize, sanitizeSchema],
  rehypeBlankLines,
]
const rehypePluginsAnnotated: PluggableList = [...rehypePlugins, rehypeSourceLine]

type Props = {
  content: string
  compact?: boolean
  className?: string
  /** Annotate rendered blocks with `data-line` for editor scroll sync. */
  annotateLines?: boolean
}

export default function MarkdownView({
  content,
  compact,
  className,
  annotateLines,
}: Props) {
  const wrapperClass = [
    'craft-prose prose-neutral dark:prose-invert',
    compact ? 'craft-prose-compact' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClass}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={annotateLines ? rehypePluginsAnnotated : rehypePlugins}
        components={{
          table({ node, ...props }) {
            return (
              <div className="markdown-table-wrapper">
                <table {...props} />
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
