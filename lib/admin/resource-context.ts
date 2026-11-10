import 'server-only'
import {distinctCategories} from '@/lib/resources/group'
import {fromRow} from '@/lib/resources/mapping'
import type {ServerClient} from '@/lib/supabase/server'

export async function loadResourceContext(supabase: ServerClient) {
  const {data} = await supabase.from('resources').select('*').order('sort_order').order('added_on')
  const rows = data ?? []
  return {
    mainResources: rows.filter((row) => row.client_id === null).map(fromRow),
    categories: distinctCategories(rows.map((row) => row.category)),
  }
}
