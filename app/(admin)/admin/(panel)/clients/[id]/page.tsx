import {notFound} from 'next/navigation'
import {AssignAdminSelect} from '@/components/admin/AssignAdminSelect'
import {ClientForm} from '@/components/admin/ClientForm'
import controls from '@/components/admin/controls.module.css'
import {CopyLinkButton} from '@/components/admin/CopyLinkButton'
import {DeleteClientButton} from '@/components/admin/DeleteClientButton'
import {requireAdmin} from '@/lib/admin/auth'
import {toFormInitial} from '@/lib/admin/form-initial'
import {loadResourceContext} from '@/lib/admin/resource-context'
import styles from '../../panel.module.css'
import detail from './detail.module.css'

export const instant = false

export default async function ClientDetail({params, searchParams}: PageProps<'/admin/clients/[id]'>) {
  const {id} = await params
  const {saved} = await searchParams
  const {supabase, isSuper} = await requireAdmin()

  const [{data: client, error}, context, {data: admins}] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, name, slug, updated_at, assigned_admin, client_emails(email, label, is_primary), client_hidden_resources(resource_id), resources!resources_client_id_fkey(*)',
      )
      .eq('id', id)
      .maybeSingle(),
    loadResourceContext(supabase),
    isSuper
      ? supabase.from('admins').select('email, display_name').order('display_name', {nullsFirst: false})
      : Promise.resolve({data: null}),
  ])
  if (error) throw new Error(`Couldn’t load the client: ${error.message}`)
  if (!client) notFound()

  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <div className={detail.heading}>
          <h1 className={styles.pageTitle}>{client.name}</h1>
          {saved && (
            <p role="status" className={controls.success}>
              Saved
            </p>
          )}
        </div>
        <div className={detail.actions}>
          <CopyLinkButton slug={client.slug} />
          <a href={`/${client.slug}`} target="_blank" rel="noopener" className={controls.button}>
            Open
          </a>
        </div>
      </header>

      {isSuper && admins && <AssignAdminSelect clientId={client.id} current={client.assigned_admin} admins={admins} />}

      <ClientForm key={`${client.id}:${client.updated_at}`} initial={toFormInitial(client)} {...context} />

      <section className={detail.danger}>
        <DeleteClientButton id={client.id} name={client.name} />
      </section>
    </div>
  )
}
