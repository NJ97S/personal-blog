'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const DEDUP_WINDOW_HOURS = 4

export async function trackView(postId: string): Promise<void> {
  if (!postId) return
  try {
    const h = headers()
    const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'anon').trim()
    const ua = h.get('user-agent') ?? ''
    const dailySalt = new Date().toISOString().slice(0, 10)
    const visitorHash = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}|${dailySalt}`)
      .digest('hex')
      .slice(0, 16)

    const supabase = createClient()
    await supabase.rpc('track_post_view', {
      p_post_id: postId,
      p_visitor_hash: visitorHash,
      p_window_hours: DEDUP_WINDOW_HOURS,
    })
  } catch (e) {
    console.warn('[trackView] failed', e)
  }
}
