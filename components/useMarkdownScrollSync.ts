import { useEffect, useRef, type RefObject } from 'react'

/**
 * Accurate, source-line based scroll sync between the @uiw/react-md-editor
 * textarea and its custom preview pane.
 *
 * Why not the library's built-in sync? It maps editor↔preview scroll with a
 * single global linear ratio (scrollHeight / scrollHeight). Because one source
 * line (e.g. an image with a long URL) wraps into many rows on the left but
 * renders as a tall image block on the right, the source→preview height
 * relationship is non-linear, so a linear ratio drifts and the two panes end up
 * showing different content.
 *
 * This hook instead builds a per-line pixel map for each side and interpolates:
 *   - editor side: an off-screen mirror styled exactly like the textarea gives
 *     the y-offset of every source line (handles soft-wrapping).
 *   - preview side: blocks carry a `data-line` attribute (see MarkdownView's
 *     `annotateLines`), so we know which source line each rendered block starts
 *     at and its y-offset.
 * Scrolling one pane finds the source line at its viewport top, then scrolls the
 * other pane so the matching line sits at its top.
 */

// CSS properties copied from the textarea so the mirror wraps text identically.
const COPY_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-indent',
  'tab-size',
  'font-variant-ligatures',
  'font-feature-settings',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'white-space',
  'word-break',
  'overflow-wrap',
  'box-sizing',
] as const

type Anchor = { line: number; top: number }

function clampScroll(el: HTMLElement, top: number): number {
  return Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight))
}

// Last index i (binary search) where values(i) <= target, assuming ascending.
function lastIndexAtMost(length: number, valueAt: (i: number) => number, target: number): number {
  let lo = 0
  let hi = length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (valueAt(mid) <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

function createController(root: HTMLElement, initialValue: string) {
  let editorArea: HTMLElement | null = null // .w-md-editor-area (scrolls)
  let textInner: HTMLElement | null = null // .w-md-editor-text (wrapping box)
  let textarea: HTMLElement | null = null // .w-md-editor-text-input
  let preview: HTMLElement | null = null // .w-md-editor-preview (scrolls)
  let mirror: HTMLDivElement | null = null

  let value = initialValue
  let editorTops: number[] = [] // editorTops[i] = y-offset of source line i+1
  let previewAnchors: Anchor[] = [] // ascending by line
  let mapsDirty = true

  let raf = 0
  let lock: 'editor' | 'preview' | null = null
  let lockTimer = 0

  let mountObserver: MutationObserver | null = null
  let resizeObserver: ResizeObserver | null = null
  let attached = false

  const ensureMirror = () => {
    if (mirror) return mirror
    const el = document.createElement('div')
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '-99999px',
      visibility: 'hidden',
      pointerEvents: 'none',
      zIndex: '-1',
    })
    document.body.appendChild(el)
    mirror = el
    return el
  }

  // Rebuild the mirror's per-line divs from the current value, matching the
  // textarea's typography and content width so wrapping is identical.
  const buildMirror = () => {
    if (!textInner || !textarea) return
    const m = ensureMirror()
    const cs = getComputedStyle(textInner)
    for (const prop of COPY_PROPS) m.style.setProperty(prop, cs.getPropertyValue(prop))
    // font-family can be set on the input rather than inherited by the box.
    m.style.setProperty('font-family', getComputedStyle(textarea).getPropertyValue('font-family'))
    m.style.width = `${textInner.clientWidth}px`

    const frag = document.createDocumentFragment()
    for (const line of value.split('\n')) {
      const div = document.createElement('div')
      // Zero-width space keeps empty lines at full line-height.
      div.textContent = line.length ? line : '​'
      frag.appendChild(div)
    }
    m.textContent = ''
    m.appendChild(frag)
  }

  const measure = () => {
    if (mirror) {
      const kids = mirror.children
      editorTops = new Array(kids.length)
      for (let i = 0; i < kids.length; i++) {
        editorTops[i] = (kids[i] as HTMLElement).offsetTop
      }
    }
    if (preview) {
      const containerTop = preview.getBoundingClientRect().top
      const baseScroll = preview.scrollTop
      const seen = new Set<number>()
      const anchors: Anchor[] = []
      preview.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
        const line = Number(el.dataset.line)
        if (!Number.isFinite(line) || seen.has(line)) return
        seen.add(line)
        anchors.push({
          line,
          top: el.getBoundingClientRect().top - containerTop + baseScroll,
        })
      })
      anchors.sort((a, b) => a.line - b.line)
      previewAnchors = anchors
    }
    mapsDirty = false
  }

  // editor scrollTop -> fractional source line (1-based)
  const lineAtEditorTop = (scrollTop: number): number => {
    const n = editorTops.length
    if (n === 0) return 1
    if (scrollTop <= editorTops[0]) return 1
    if (scrollTop >= editorTops[n - 1]) return n
    const i = lastIndexAtMost(n, (k) => editorTops[k], scrollTop)
    const top = editorTops[i]
    const next = editorTops[i + 1] ?? top
    const frac = next > top ? (scrollTop - top) / (next - top) : 0
    return i + 1 + frac
  }

  // fractional source line -> editor scrollTop
  const editorTopForLine = (line: number): number => {
    const n = editorTops.length
    if (n === 0) return 0
    const idx = Math.floor(line) - 1
    if (idx <= 0) return editorTops[0]
    if (idx >= n - 1) return editorTops[n - 1]
    return editorTops[idx] + (editorTops[idx + 1] - editorTops[idx]) * (line - Math.floor(line))
  }

  // fractional source line -> preview scrollTop (interpolated between anchors)
  const previewTopForLine = (line: number): number => {
    const n = previewAnchors.length
    if (n === 0) return 0
    if (line <= previewAnchors[0].line) return previewAnchors[0].top
    if (line >= previewAnchors[n - 1].line) return previewAnchors[n - 1].top
    const i = lastIndexAtMost(n, (k) => previewAnchors[k].line, line)
    const a = previewAnchors[i]
    const b = previewAnchors[i + 1] ?? a
    const frac = b.line > a.line ? (line - a.line) / (b.line - a.line) : 0
    return a.top + (b.top - a.top) * frac
  }

  // preview scrollTop -> fractional source line
  const lineAtPreviewTop = (scrollTop: number): number => {
    const n = previewAnchors.length
    if (n === 0) return 1
    if (scrollTop <= previewAnchors[0].top) return previewAnchors[0].line
    if (scrollTop >= previewAnchors[n - 1].top) return previewAnchors[n - 1].line
    const i = lastIndexAtMost(n, (k) => previewAnchors[k].top, scrollTop)
    const a = previewAnchors[i]
    const b = previewAnchors[i + 1] ?? a
    const frac = b.top > a.top ? (scrollTop - a.top) / (b.top - a.top) : 0
    return a.line + (b.line - a.line) * frac
  }

  // Fallback: linear ratio when line anchors are unavailable (never worse than
  // the library's default behaviour).
  const canMap = () => editorTops.length >= 2 && previewAnchors.length >= 2
  const proportional = (from: HTMLElement, to: HTMLElement): number => {
    const fromRange = from.scrollHeight - from.clientHeight
    const toRange = to.scrollHeight - to.clientHeight
    if (fromRange <= 0) return 0
    return (from.scrollTop / fromRange) * toRange
  }

  const setLock = (who: 'editor' | 'preview') => {
    lock = who
    clearTimeout(lockTimer)
    lockTimer = window.setTimeout(() => {
      lock = null
    }, 150)
  }

  const syncFromEditor = () => {
    if (!editorArea || !preview) return
    if (mapsDirty) measure()
    const target = canMap()
      ? previewTopForLine(lineAtEditorTop(editorArea.scrollTop))
      : proportional(editorArea, preview)
    preview.scrollTop = clampScroll(preview, target)
  }

  const syncFromPreview = () => {
    if (!editorArea || !preview) return
    if (mapsDirty) measure()
    const target = canMap()
      ? editorTopForLine(lineAtPreviewTop(preview.scrollTop))
      : proportional(preview, editorArea)
    editorArea.scrollTop = clampScroll(editorArea, target)
  }

  const onEditorScroll = () => {
    if (lock === 'preview') return
    setLock('editor')
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(syncFromEditor)
  }

  const onPreviewScroll = () => {
    if (lock === 'editor') return
    setLock('preview')
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(syncFromPreview)
  }

  const onImageLoad = () => {
    mapsDirty = true
  }

  const attach = (): boolean => {
    editorArea = root.querySelector('.w-md-editor-area')
    textInner = root.querySelector('.w-md-editor-text')
    textarea = root.querySelector('.w-md-editor-text-input')
    preview = root.querySelector('.w-md-editor-preview')
    if (!editorArea || !textInner || !textarea || !preview) return false

    buildMirror()
    mapsDirty = true

    editorArea.addEventListener('scroll', onEditorScroll, { passive: true })
    preview.addEventListener('scroll', onPreviewScroll, { passive: true })
    // Image loads change preview heights -> invalidate the anchor map.
    preview.addEventListener('load', onImageLoad, true)

    resizeObserver = new ResizeObserver(() => {
      buildMirror()
      mapsDirty = true
    })
    resizeObserver.observe(editorArea)
    resizeObserver.observe(preview)

    attached = true
    return true
  }

  // The editor is dynamically imported, so its DOM may not exist yet.
  if (!attach()) {
    mountObserver = new MutationObserver(() => {
      if (attach() && mountObserver) {
        mountObserver.disconnect()
        mountObserver = null
      }
    })
    mountObserver.observe(root, { childList: true, subtree: true })
  }

  return {
    onValueChange(next: string) {
      value = next
      if (attached) buildMirror()
      mapsDirty = true
    },
    destroy() {
      cancelAnimationFrame(raf)
      clearTimeout(lockTimer)
      mountObserver?.disconnect()
      resizeObserver?.disconnect()
      editorArea?.removeEventListener('scroll', onEditorScroll)
      preview?.removeEventListener('scroll', onPreviewScroll)
      preview?.removeEventListener('load', onImageLoad, true)
      mirror?.remove()
      mirror = null
    },
  }
}

export function useMarkdownScrollSync(
  rootRef: RefObject<HTMLElement | null>,
  value: string,
) {
  const controllerRef = useRef<ReturnType<typeof createController> | null>(null)

  useEffect(() => {
    if (!rootRef.current) return
    const controller = createController(rootRef.current, value)
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
    // Intentionally run once: the controller observes DOM mount itself and
    // value updates flow through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef])

  useEffect(() => {
    controllerRef.current?.onValueChange(value)
  }, [value])
}
