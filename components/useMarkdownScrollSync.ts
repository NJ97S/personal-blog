import { useEffect, useRef, type RefObject } from 'react'

/**
 * Accurate, source-line based scroll sync between the @uiw/react-md-editor
 * textarea and its custom preview pane.
 *
 * Why not the library's built-in sync? It maps editor↔preview scroll with a
 * single global linear ratio (scrollHeight / scrollHeight). Because one source
 * line (e.g. an image with a long URL) wraps into many rows on the left but
 * renders as a tall block on the right, the source→preview height relationship
 * is non-linear, so a linear ratio drifts and the panes show different content.
 *
 * This hook builds a monotonic "source line ↔ pixel" map for each side and
 * interpolates between them:
 *   - editor side: an off-screen mirror styled exactly like the textarea yields
 *     the y-offset of every source line (so soft-wrapping is captured).
 *   - preview side: each rendered block carries `data-line`/`data-line-end`
 *     (see MarkdownView's `annotateLines`), so we know the source line range a
 *     block spans and its pixel span — letting us interpolate *through* tall
 *     blocks (images, code, tables, raw HTML) instead of snapping to one point.
 *
 * Reflows that change preview height (images finishing loading, typing) are
 * watched with a ResizeObserver on the preview content, which re-measures and
 * re-aligns from whichever pane the user last drove — so the preview never sits
 * stale and then jumps on the next scroll.
 */

// CSS properties copied from the editor's text box so the mirror wraps text
// identically (otherwise per-line offsets would drift).
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

// A monotonic map of {source line -> pixel top}, ascending in both fields.
type Point = { line: number; top: number }

function clampScroll(el: HTMLElement, top: number): number {
  return Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight))
}

// Largest index i with arr[i][field] <= target (ascending arr). target is
// assumed within [arr[0], arr[n-1]].
function bisect(arr: Point[], field: 'line' | 'top', target: number): number {
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (arr[mid][field] <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

function topForLine(map: Point[], line: number): number {
  const n = map.length
  if (n === 0) return 0
  if (line <= map[0].line) return map[0].top
  if (line >= map[n - 1].line) return map[n - 1].top
  const i = bisect(map, 'line', line)
  const a = map[i]
  const b = map[i + 1] ?? a
  return a.top + (b.top - a.top) * (b.line > a.line ? (line - a.line) / (b.line - a.line) : 0)
}

function lineForTop(map: Point[], top: number): number {
  const n = map.length
  if (n === 0) return 1
  if (top <= map[0].top) return map[0].line
  if (top >= map[n - 1].top) return map[n - 1].line
  const i = bisect(map, 'top', top)
  const a = map[i]
  const b = map[i + 1] ?? a
  return a.line + (b.line - a.line) * (b.top > a.top ? (top - a.top) / (b.top - a.top) : 0)
}

function createController(root: HTMLElement, initialValue: string) {
  let editorArea: HTMLElement | null = null // .w-md-editor-area (scrolls)
  let textInner: HTMLElement | null = null // .w-md-editor-text (wrapping box)
  let textarea: HTMLElement | null = null // .w-md-editor-text-input
  let preview: HTMLElement | null = null // .w-md-editor-preview (scrolls)
  let previewContent: HTMLElement | null = null // first child holding rendered markdown
  let mirror: HTMLDivElement | null = null

  let value = initialValue
  let editorMap: Point[] = [] // source line -> y in editor scroll content
  let previewMap: Point[] = [] // source line -> y in preview scroll content
  let mapsDirty = true

  let raf = 0
  let lastDriver: 'editor' | 'preview' = 'editor'
  let lock: 'editor' | 'preview' | null = null
  let lockTimer = 0

  let mountObserver: MutationObserver | null = null
  let sizeObserver: ResizeObserver | null = null
  let contentObserver: ResizeObserver | null = null
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
  // editor's typography and content width so wrapping is identical.
  //
  // Copy styles from the *textarea* (and its highlight <pre>) — the element that
  // actually lays the text out — NOT from `.w-md-editor-text`. They disagree on
  // `word-break`: the wrapper says `keep-all` but the textarea overrides it to
  // `break-word`. Copying the wrong one makes the mirror wrap far less than the
  // real editor on real content (long code lines, Korean prose), so the line
  // map underestimates positions and the preview drifts.
  const buildMirror = () => {
    if (!textarea) return
    const m = ensureMirror()
    const cs = getComputedStyle(textarea)
    for (const prop of COPY_PROPS) m.style.setProperty(prop, cs.getPropertyValue(prop))
    m.style.width = `${textarea.clientWidth}px`

    // Normalise line endings: the editor and the markdown parser both treat
    // CRLF/CR as one break, so split the same way (one div per source line).
    const lines = value.replace(/\r\n?/g, '\n').split('\n')
    const frag = document.createDocumentFragment()
    for (const line of lines) {
      const div = document.createElement('div')
      div.textContent = line.length ? line : '​' // ZWSP keeps empty lines tall
      frag.appendChild(div)
    }
    m.textContent = ''
    m.appendChild(frag)
  }

  // Enforce ascending-by-line and non-decreasing-by-top, collapsing duplicate
  // lines (keep outermost = smallest top) so interpolation never reverses.
  const monotonic = (points: Point[]): Point[] => {
    points.sort((a, b) => a.line - b.line || a.top - b.top)
    const out: Point[] = []
    for (const p of points) {
      const last = out[out.length - 1]
      if (last && last.line === p.line) continue
      if (last && p.top < last.top) out.push({ line: p.line, top: last.top })
      else out.push(p)
    }
    return out
  }

  const measure = () => {
    if (mirror) {
      const kids = mirror.children
      const pts: Point[] = new Array(kids.length)
      for (let i = 0; i < kids.length; i++) {
        pts[i] = { line: i + 1, top: (kids[i] as HTMLElement).offsetTop }
      }
      editorMap = pts
    }
    if (preview) {
      const cTop = preview.getBoundingClientRect().top
      const base = preview.scrollTop
      const pts: Point[] = []
      preview.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
        const start = Number(el.dataset.line)
        if (!Number.isFinite(start)) return
        const endRaw = Number(el.dataset.lineEnd)
        const end = Number.isFinite(endRaw) ? endRaw : start
        const r = el.getBoundingClientRect()
        pts.push({ line: start, top: r.top - cTop + base })
        // The block occupies source lines [start, end]; attribute its bottom to
        // the line just after it so lines inside map across its full pixel span.
        pts.push({ line: end + 1, top: r.bottom - cTop + base })
      })
      previewMap = monotonic(pts)
    }
    mapsDirty = false
  }

  const canMap = () => editorMap.length >= 2 && previewMap.length >= 2

  // Fallback linear ratio if line anchors are unavailable (never worse than the
  // library's default behaviour).
  const proportional = (from: HTMLElement, to: HTMLElement): number => {
    const fromRange = from.scrollHeight - from.clientHeight
    const toRange = to.scrollHeight - to.clientHeight
    if (fromRange <= 0) return 0
    return (from.scrollTop / fromRange) * toRange
  }

  // Follower scroll position for the driver's current scroll, mapped by source
  // line so the line at the driver's viewport top sits at the follower's top.
  // (Below that shared top line the panes legitimately diverge in height — a
  // tall image makes the preview longer — but the top, which is what the user
  // reads against, stays aligned. The user can reach any preview position by
  // scrolling the preview directly, which drives the editor in reverse.)
  const mappedTarget = (
    driver: HTMLElement,
    follower: HTMLElement,
    driverMap: Point[],
    followerMap: Point[],
  ): number => clampScroll(follower, topForLine(followerMap, lineForTop(driverMap, driver.scrollTop)))

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
    preview.scrollTop = canMap()
      ? mappedTarget(editorArea, preview, editorMap, previewMap)
      : clampScroll(preview, proportional(editorArea, preview))
  }

  const syncFromPreview = () => {
    if (!editorArea || !preview) return
    if (mapsDirty) measure()
    editorArea.scrollTop = canMap()
      ? mappedTarget(preview, editorArea, previewMap, editorMap)
      : clampScroll(editorArea, proportional(preview, editorArea))
  }

  const onEditorScroll = () => {
    if (lock === 'preview') return
    lastDriver = 'editor'
    setLock('editor')
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(syncFromEditor)
  }

  const onPreviewScroll = () => {
    if (lock === 'editor') return
    lastDriver = 'preview'
    setLock('preview')
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(syncFromPreview)
  }

  // Preview content reflowed (image loaded, typing, etc.): re-measure and
  // re-align from the pane the user last drove, holding the lock so the
  // programmatic scroll we trigger isn't mistaken for user input.
  const onContentResize = () => {
    mapsDirty = true
    if (!attached) return
    setLock(lastDriver)
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(lastDriver === 'preview' ? syncFromPreview : syncFromEditor)
  }

  const findPreviewContent = () =>
    (preview?.querySelector(':scope > .craft-prose') as HTMLElement | null) ??
    (preview?.firstElementChild as HTMLElement | null)

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

    // Width changes re-wrap the mirror; observe the panes themselves.
    sizeObserver = new ResizeObserver(() => {
      buildMirror()
      mapsDirty = true
    })
    sizeObserver.observe(editorArea)
    sizeObserver.observe(preview)

    // Height changes (image load, reflow) come from the *content*, not the
    // fixed-height pane — observe it and re-align.
    previewContent = findPreviewContent()
    if (previewContent) {
      contentObserver = new ResizeObserver(onContentResize)
      contentObserver.observe(previewContent)
    }

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
      // Preview content node is recreated on re-render; re-bind the observer.
      if (attached && contentObserver) {
        const node = findPreviewContent()
        if (node && node !== previewContent) {
          contentObserver.disconnect()
          previewContent = node
          contentObserver.observe(node)
        }
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      clearTimeout(lockTimer)
      mountObserver?.disconnect()
      sizeObserver?.disconnect()
      contentObserver?.disconnect()
      editorArea?.removeEventListener('scroll', onEditorScroll)
      preview?.removeEventListener('scroll', onPreviewScroll)
      mirror?.remove()
      mirror = null
    },
  }
}

export function useMarkdownScrollSync(
  rootRef: RefObject<HTMLElement | null>,
  value: string,
  enabled = true,
) {
  const controllerRef = useRef<ReturnType<typeof createController> | null>(null)

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.destroy()
      controllerRef.current = null
      return
    }
    if (!rootRef.current) return
    const controller = createController(rootRef.current, value)
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
    // Run once: the controller observes DOM mount itself; value updates flow
    // through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, enabled])

  useEffect(() => {
    if (!enabled) return
    controllerRef.current?.onValueChange(value)
  }, [enabled, value])
}
