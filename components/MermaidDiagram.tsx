'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { fitMermaidSvg } from '@/lib/mermaid-layout'

// Mermaid의 전역 설정과 임시 렌더링 DOM이 여러 도식 사이에서 충돌하지 않게 직렬화합니다.
let renderQueue: Promise<void> = Promise.resolve()

type Props = {
  source: string
  sourceLine?: number
  sourceLineEnd?: number
}

type RenderResult = {
  source: string
  dark: boolean
  svg?: string
  failed?: boolean
}

export default function MermaidDiagram({ source, sourceLine, sourceLineEnd }: Props) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [result, setResult] = useState<RenderResult | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    // 작성 중 매 키 입력마다 무거운 레이아웃 계산을 하지 않습니다.
    const timer = window.setTimeout(() => {
      const render = async () => {
        if (cancelled) return
        let container: HTMLDivElement | undefined
        try {
          const { default: mermaid } = await import('mermaid')
          await document.fonts.ready
          if (cancelled || !rootRef.current) return

          // 본문과 14px 미리보기 각각의 실제 글꼴을 사용해 크기와 줄바꿈을 계산합니다.
          const typography = getComputedStyle(rootRef.current)
          const fontFamily = typography.fontFamily
          const fontSize = parseFloat(typography.fontSize)
          const colors = dark
            ? {
                background: '#241c16', node: '#30261d', group: '#2a2018',
                border: '#7e6952', text: '#f5ead6', line: '#b6a18a', note: '#3a2e20',
              }
            : {
                background: '#fcf7ee', node: '#fffdf8', group: '#f7efdf',
                border: '#cbb894', text: '#4a3f35', line: '#9a8264', note: '#f5ead6',
              }

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'base',
            fontFamily,
            fontSize,
            themeVariables: {
              darkMode: dark,
              fontFamily,
              fontSize: `${fontSize}px`,
              background: colors.background,
              primaryColor: colors.node,
              primaryTextColor: colors.text,
              primaryBorderColor: colors.border,
              secondaryColor: colors.note,
              secondaryTextColor: colors.text,
              secondaryBorderColor: colors.border,
              tertiaryColor: colors.group,
              tertiaryTextColor: colors.text,
              tertiaryBorderColor: colors.border,
              lineColor: colors.line,
              textColor: colors.text,
              mainBkg: colors.node,
              nodeBorder: colors.border,
              nodeTextColor: colors.text,
              clusterBkg: colors.group,
              clusterBorder: colors.border,
              titleColor: colors.text,
              defaultLinkColor: colors.line,
              edgeLabelBackground: colors.background,
              actorBkg: colors.node,
              actorBorder: colors.border,
              actorTextColor: colors.text,
              actorLineColor: colors.border,
              signalColor: colors.line,
              signalTextColor: colors.text,
              noteBkgColor: colors.note,
              noteBorderColor: colors.border,
              noteTextColor: colors.text,
            },
            flowchart: {
              useMaxWidth: false,
              curve: 'rounded',
              nodeSpacing: 28,
              rankSpacing: 36,
              padding: 14,
              diagramPadding: 16,
              wrappingWidth: 260,
            },
            sequence: {
              useMaxWidth: false,
              actorFontFamily: fontFamily,
              actorFontSize: fontSize,
              noteFontFamily: fontFamily,
              noteFontSize: fontSize,
              messageFontFamily: fontFamily,
              messageFontSize: fontSize,
              actorMargin: 36,
              width: 140,
              height: 44,
              messageMargin: 28,
              boxMargin: 8,
              noteMargin: 8,
              mirrorActors: false,
              wrap: true,
              wrapPadding: 10,
              diagramMarginX: 24,
              diagramMarginY: 24,
            },
          })

          // display:none에서는 글자 크기를 측정할 수 없으므로 화면 밖에서 렌더링합니다.
          container = document.createElement('div')
          container.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;'
          container.className = 'craft-prose'
          container.style.fontFamily = fontFamily
          container.style.fontSize = `${fontSize}px`
          container.style.lineHeight = typography.lineHeight
          const stage = document.createElement('div')
          stage.className = 'markdown-mermaid-diagram not-prose'
          container.appendChild(stage)
          document.body.appendChild(container)
          const { svg } = await mermaid.render(id, source, stage)
          const fittedSvg = fitMermaidSvg(stage, svg)
          if (!cancelled) setResult({ source, dark, svg: fittedSvg })
        } catch {
          // 문법이 미완성인 동안에도 에디터와 나머지 본문은 계속 사용할 수 있습니다.
          if (!cancelled) setResult({ source, dark, failed: true })
        } finally {
          container?.remove()
        }
      }
      renderQueue = renderQueue.then(render, render)
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, dark, id])

  const current = result?.source === source && result.dark === dark ? result : null

  useEffect(() => {
    const viewport = viewportRef.current
    const diagram = viewport?.querySelector('.markdown-mermaid-diagram')
    if (!viewport || !diagram) {
      setHasOverflow(false)
      return
    }
    const check = () => setHasOverflow(viewport.scrollWidth > viewport.clientWidth + 1)
    const observer = new ResizeObserver(check)
    observer.observe(viewport)
    observer.observe(diagram)
    check()
    return () => observer.disconnect()
  }, [current?.svg])

  return (
    <div
      ref={rootRef}
      className="markdown-mermaid not-prose"
      data-line={sourceLine}
      data-line-end={sourceLineEnd}
    >
      {current?.svg ? (
        <>
          {hasOverflow && (
            <p className="markdown-mermaid-hint">좌우로 스크롤해 전체 도식을 볼 수 있습니다.</p>
          )}
          <div
            ref={viewportRef}
            className="markdown-mermaid-viewport"
            role="region"
            aria-label={hasOverflow ? '다이어그램, 좌우로 스크롤 가능' : '다이어그램'}
            tabIndex={hasOverflow ? 0 : undefined}
          >
            <div
              className="markdown-mermaid-diagram"
              role="img"
              aria-label="Mermaid 다이어그램"
              // strict 모드에서 Mermaid가 생성하고 정제한 SVG만 삽입합니다.
              dangerouslySetInnerHTML={{ __html: current.svg }}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-500 dark:text-craft-300" role="status">
            {current?.failed
              ? '다이어그램을 표시하지 못했습니다. Mermaid 문법을 확인해 주세요.'
              : '다이어그램을 불러오는 중…'}
          </p>
          <pre><code className="language-mermaid">{source}</code></pre>
        </>
      )}
    </div>
  )
}
