import {Plus} from 'lucide-react'
import Link from 'next/link'
import {ClientTable} from '@/components/admin/ClientTable'
import controls from '@/components/admin/controls.module.css'
import {requireAdmin} from '@/lib/admin/auth'
import {cx} from '@/lib/cx'
import styles from './panel.module.css'

export const instant = false

export default async function ClientIndex() {
  const {supabase, admin, isSuper} = await requireAdmin()
  const {data} = await supabase
    .from('clients')
    .select(
      'id, name, slug, created_at, assigned_admin, owner:admins!clients_assigned_admin_fkey(display_name), client_emails(email, is_primary)',
    )
    .order('created_at', {ascending: false})

  const rows = (data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    createdAt: client.created_at,
    primaryEmail: client.client_emails.find((email) => email.is_primary)?.email ?? '',
    auxCount: client.client_emails.filter((email) => !email.is_primary).length,
    allEmails: client.client_emails.map((email) => email.email),
    owner: client.owner?.display_name ?? client.assigned_admin,
    isMine: client.assigned_admin === admin.email,
  }))

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{isSuper ? 'Clients' : 'Your Clients'}</h1>
        <Link href="/admin/clients/new" className={cx(controls.button, controls.primary)}>
          <Plus aria-hidden size={14} />
          New client
        </Link>
      </header>
      <ClientTable rows={rows} showOwner={isSuper} />
    </>
  )
}
