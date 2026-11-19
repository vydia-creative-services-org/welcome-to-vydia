import {requireEnv, type Check} from '@/lib/health'

/** Empty send → Resend rejects the body with 422 (key accepted). Nothing is sent. Verify once by hand. */
export const resendKey: Check = async (signal) => {
  requireEnv('RESEND_API_KEY', 'EMAIL_FROM')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: '{}',
    signal,
  })
  if (res.status !== 422) throw new Error(`HTTP ${res.status}`)
}
