import type {EmailRow} from '@/components/admin/EmailRows'
import {fromRow} from '@/lib/resources/mapping'
import type {Database} from '@/lib/supabase/database.types'
import {draftFromResource, type ResourceDraft} from './drafts'

type ResourceRow = Database['public']['Tables']['resources']['Row']

export type ClientFormInitial = {
  id?: string
  name: string
  slug: string
  primaryEmail: string
  auxEmails: EmailRow[]
  hiddenResourceIds: string[]
  exclusiveResources: ResourceDraft[]
}

export type ClientRecord = {
  id: string
  name: string
  slug: string
  client_emails: {email: string; label: string | null; is_primary: boolean}[]
  client_hidden_resources: {resource_id: string}[]
  resources: ResourceRow[]
}

export const emptyClientForm: ClientFormInitial = {
  name: '',
  slug: '',
  primaryEmail: '',
  auxEmails: [],
  hiddenResourceIds: [],
  exclusiveResources: [],
}

export function toFormInitial(client: ClientRecord): ClientFormInitial {
  const primary = client.client_emails.find((email) => email.is_primary)
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    primaryEmail: primary?.email ?? '',
    auxEmails: client.client_emails
      .filter((email) => !email.is_primary)
      .map((email) => ({key: crypto.randomUUID(), email: email.email, label: email.label ?? ''})),
    hiddenResourceIds: client.client_hidden_resources.map((hide) => hide.resource_id),
    exclusiveResources: [...client.resources]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => draftFromResource(fromRow(row))),
  }
}
