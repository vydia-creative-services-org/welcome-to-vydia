import Link from 'next/link'
import {ClientTable} from '@/components/admin/ClientTable'
import controls from '@/components/admin/controls.module.css'
import {requireAdmin} from '@/lib/admin/auth'
import styles from './panel.module.css'

export const instant = false

export default async function ClientIndex() {
  const {supabase} = await requireAdmin()
  const {data} = await supabase
    .from('clients')
    .select('id, name, slug, created_at, client_emails(email, is_primary)')
    .order('created_at', {ascending: false})

  const rows = (data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    createdAt: client.created_at,
    primaryEmail: client.client_emails.find((email) => email.is_primary)?.email ?? '',
    auxCount: client.client_emails.filter((email) => !email.is_primary).length,
    allEmails: client.client_emails.map((email) => email.email),
  }))

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Clients</h1>
        <Link href="/admin/clients/new" className={`${controls.button} ${controls.primary}`}>
          New client
        </Link>
      </header>
      <ClientTable rows={rows} />
    </>
  )
}
