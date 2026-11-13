import 'server-only'

export type OutgoingEmail = {to: string; subject: string; html: string; text: string}

const RESEND_URL = 'https://api.resend.com/emails'

// Sends through Resend's HTTP API (not Supabase Auth), so Supabase's per-email and hourly email limits don't apply
// and a failure is reported back instead of being swallowed. Returns whether Resend accepted the email.
export async function sendEmail(message: OutgoingEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    if (process.env.NODE_ENV !== 'production') {
      // Local development without Resend: print the email instead, and count it as sent.
      console.info(`[email not sent: no RESEND_API_KEY/EMAIL_FROM] to ${message.to}\n${message.text}`)
      return true
    }
    console.error('Email not sent: RESEND_API_KEY and EMAIL_FROM must be set.')
    return false
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from, to: [message.to], subject: message.subject, html: message.html, text: message.text}),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return true
    console.error('Email not sent:', response.status, (await response.text()).slice(0, 300))
  } catch (error) {
    console.error('Email not sent:', error instanceof Error ? error.message : error)
  }
  return false
}
