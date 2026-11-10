import type {EmailRow} from '@/components/admin/EmailRows'
import {fromRow} from '@/lib/resources/mapping'
import type {Database} from '@/lib/supabase/database.types'
import {draftFromResource, type ResourceDraft} from './drafts'

type ResourceRow = Database['public']['Tables']['resources']['Row']

export type ArtistFormInitial = {
  id?: string
  name: string
  slug: string
  primaryEmail: string
  auxEmails: EmailRow[]
  hiddenResourceIds: string[]
  exclusiveResources: ResourceDraft[]
}

export type ArtistRecord = {
  id: string
  name: string
  slug: string
  artist_emails: {email: string; label: string | null; is_primary: boolean}[]
  artist_hidden_resources: {resource_id: string}[]
  resources: ResourceRow[]
}

export const emptyArtistForm: ArtistFormInitial = {
  name: '',
  slug: '',
  primaryEmail: '',
  auxEmails: [],
  hiddenResourceIds: [],
  exclusiveResources: [],
}

export function toFormInitial(artist: ArtistRecord): ArtistFormInitial {
  const primary = artist.artist_emails.find((email) => email.is_primary)
  return {
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    primaryEmail: primary?.email ?? '',
    auxEmails: artist.artist_emails
      .filter((email) => !email.is_primary)
      .map((email) => ({key: crypto.randomUUID(), email: email.email, label: email.label ?? ''})),
    hiddenResourceIds: artist.artist_hidden_resources.map((hide) => hide.resource_id),
    exclusiveResources: [...artist.resources]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => draftFromResource(fromRow(row))),
  }
}
