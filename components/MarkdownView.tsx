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

// Stamp each rendered element with the markdown source line it originates from.
// Runs *after* rehypeSanitize: hast-util-sanitize preserves node.position, so we
// can safely add the `data-line` attribute without it being stripped or needing
// a schema whitelist. The editor preview uses these anchors for scroll sync.
function rehypeSourceLine() {
  return (tree: unknown) => {
    const walk = (node: any) => {
      if (node?.type === 'element' && node.position?.start?.line != null) {
        node.properties = node.properties ?? {}
        node.properties.dataLine = String(node.position.start.line)
      }
      if (Array.isArray(node?.children)) node.children.forEach(walk)
    }
    walk(tree)
  }
}

const remarkPlugins: PluggableList = [remarkGfm, remarkBreaks]
const rehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeSlug,
  rehypeHighlight,
  [rehypeSanitize, sanitizeSchema],
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
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
