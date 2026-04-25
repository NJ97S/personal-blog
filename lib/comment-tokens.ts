const KEY = 'comment-tokens'

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // localStorage가 차단된 환경 (private mode 등) — 무시
  }
}

export function saveToken(commentId: string, token: string): void {
  const map = readMap()
  map[commentId] = token
  writeMap(map)
}

export function getToken(commentId: string): string | null {
  const map = readMap()
  return map[commentId] ?? null
}

export function removeToken(commentId: string): void {
  const map = readMap()
  if (!(commentId in map)) return
  delete map[commentId]
  writeMap(map)
}
