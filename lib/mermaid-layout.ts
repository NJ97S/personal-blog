// Mermaid가 정제한 SVG만 받습니다. 폰트 로딩 후, 실제 표시할 CSS 안에서 측정해야 합니다.
export function fitMermaidSvg(container: HTMLElement, markup: string): string {
  container.innerHTML = markup
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('Mermaid did not return an SVG')

  // HTML 레이블의 끝 글자가 foreignObject 경계에서 잘리지 않게 합니다.
  svg.querySelectorAll('foreignObject').forEach((label) => {
    label.style.overflow = 'visible'
  })

  const viewBox = svg.viewBox.baseVal
  let left = viewBox.x
  let top = viewBox.y
  let right = viewBox.x + viewBox.width
  let bottom = viewBox.y + viewBox.height

  // getBBox만으로는 HTML 내용이나 폰트의 실제 글자 끝까지 포함되지 않을 수 있습니다.
  const inverse = svg.getScreenCTM()?.inverse()
  if (inverse) {
    svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, .nodeLabel, .edgeLabel, .noteText, .messageText')
      .forEach((element) => {
        // 시퀀스의 생명선은 끝까지 보이도록 2000px 이상 그린 뒤 의도적으로 잘라냅니다.
        // 보조선까지 전체 경계에 포함하면 실제 내용 아래에 긴 빈 공간이 생깁니다.
        if (element.closest('defs, clipPath, mask') || element.classList.contains('actor-line')) return
        const isLabel = element.matches('text, .nodeLabel, .edgeLabel, .noteText, .messageText')
        const range = document.createRange()
        range.selectNodeContents(element)
        const rect = isLabel ? range.getBoundingClientRect() : element.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const start = new DOMPoint(rect.left, rect.top).matrixTransform(inverse)
        const end = new DOMPoint(rect.right, rect.bottom).matrixTransform(inverse)
        left = Math.min(left, start.x, end.x)
        top = Math.min(top, start.y, end.y)
        right = Math.max(right, start.x, end.x)
        bottom = Math.max(bottom, start.y, end.y)
      })
  }

  // 선의 두께와 화살표 끝은 getBBox에 포함되지 않으므로 사방에 여백을 둡니다.
  const padding = Math.max(16, parseFloat(getComputedStyle(svg).fontSize) || 16)
  const width = Math.ceil(right - left + padding * 2)
  const height = Math.ceil(bottom - top + padding * 2)
  svg.setAttribute('viewBox', `${left - padding} ${top - padding} ${width} ${height}`)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet')
  svg.style.width = `${width}px`
  svg.style.maxWidth = 'none'
  svg.style.removeProperty('height')
  // 실제 내용은 확장한 viewBox 안에 두고, 생명선 같은 보조선은 밖으로 새지 않게 합니다.
  svg.style.overflow = 'hidden'
  return svg.outerHTML
}
