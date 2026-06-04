const TELEGRAM_API = 'https://api.telegram.org'

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('[telegram] env not configured, skip')
    return false
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[telegram] non-200', res.status, body)
      return false
    }
    return true
  } catch (e) {
    console.warn('[telegram] send failed', e)
    return false
  }
}

// HTML parse_mode 메시지에서 텍스트 노드뿐 아니라 `href="..."` 같은
// 속성 컨텍스트에도 동일 함수가 사용되므로 따옴표까지 모두 이스케이프합니다.
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
