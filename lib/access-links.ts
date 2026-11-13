import 'server-only'
import {SITE_URL} from '@/lib/env'
import {sendEmail} from '@/lib/resend'
import {createServiceClient} from '@/lib/supabase/service'
import {accessLink, welcomeEmail} from '@/lib/welcome-email'

export type AccessLinkRow = {email: string; token: string; client_name: string}

type Service = ReturnType<typeof createServiceClient>

const deliver = (row: AccessLinkRow) =>
  sendEmail({
    to: row.email,
    ...welcomeEmail({
      siteUrl: SITE_URL,
      email: row.email,
      clientName: row.client_name,
      link: accessLink(SITE_URL, row.token),
    }),
  })

async function markSent(service: Service, tokens: string[]) {
  if (!tokens.length) return
  const {error} = await service.rpc('mark_access_links_sent', {p_tokens: tokens})
  if (error) console.error('mark_access_links_sent failed:', error.code)
}

async function unsent(service: Service, clientId: string) {
  const {data, error} = await service.rpc('unsent_access_links', {p_client_id: clientId})
  if (error) console.error('unsent_access_links failed:', error.code)
  return data ?? []
}

/** Emails one person their permanent link. Returns whether it was sent. */
export async function sendAccessLink(row: AccessLinkRow, service: Service = createServiceClient()) {
  const sent = await deliver(row)
  if (sent) await markSent(service, [row.token])
  return sent
}

/**
 * Emails every email on the client that hasn't had its link yet: a new client's emails, or emails just added to an
 * existing one. Returns the emails that couldn't be sent; they stay pending so the client page can offer a retry.
 * Callers must have checked that the admin may manage this client.
 */
export async function sendWelcomeEmails(clientId: string): Promise<{failed: string[]}> {
  const service = createServiceClient()
  const rows = await unsent(service, clientId)
  const sent = await Promise.all(rows.map(deliver))
  await markSent(
    service,
    rows.filter((_, index) => sent[index]).map((row) => row.token),
  )
  return {failed: rows.filter((_, index) => !sent[index]).map((row) => row.email)}
}

/** Emails on the client whose link hasn't been sent yet (a send failed). Callers must have checked access. */
export async function unsentEmails(clientId: string): Promise<string[]> {
  return (await unsent(createServiceClient(), clientId)).map((row) => row.email)
}
