'use server'
import {refresh} from 'next/cache'
import {redirect} from 'next/navigation'
import {z} from 'zod'
import {sendWelcomeEmails} from '@/lib/access-links'
import {requireAdmin} from '@/lib/admin/auth'
import {mapSaveError} from '@/lib/admin/errors'
import {sweepStorage} from '@/lib/admin/storage'
import {clientPayload, type ClientInput} from '@/lib/validation'

export type SaveResult = {ok: false; fieldErrors: Record<string, string>; formError?: string}

export async function saveClient(input: ClientInput): Promise<SaveResult> {
  const {supabase} = await requireAdmin()
  const parsed = clientPayload.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message
    return {ok: false, fieldErrors}
  }

  const {data: id, error} = await supabase.rpc('save_client', {payload: parsed.data})
  if (error) {
    const mapped = mapSaveError(error)
    if (mapped) return {ok: false, fieldErrors: {[mapped.field]: mapped.message}}
    if (error.code === 'P0002') {
      return {ok: false, fieldErrors: {}, formError: 'This client no longer exists or isn’t assigned to you.'}
    }
    console.error('save_client failed:', error.code, error.message)
    return {ok: false, fieldErrors: {}, formError: 'Couldn’t save. Nothing was changed. Try again.'}
  }

  // Every email that's new on this client gets its permanent link. A failed send stays pending, and the client page
  // shows it with a retry, so a save never silently skips anyone.
  await Promise.all([sweepStorage(supabase), sendWelcomeEmails(id)])
  redirect(`/admin/clients/${id}?saved=1`)
}

export async function retryWelcomeEmails(clientId: string): Promise<{ok: boolean; failed: string[]}> {
  const {supabase} = await requireAdmin()
  const {data: mayManage} = await supabase.rpc('can_manage_client', {target: clientId})
  if (!mayManage) return {ok: false, failed: []}
  const {failed} = await sendWelcomeEmails(clientId)
  refresh()
  return {ok: failed.length === 0, failed}
}

export async function deleteClient(id: string): Promise<{ok: false; message: string}> {
  const {supabase} = await requireAdmin()
  const {data, error} = await supabase.from('clients').delete().eq('id', id).select('id')
  if (error || !data?.length) return {ok: false, message: 'Couldn’t delete the client. Nothing was changed.'}
  await sweepStorage(supabase)
  redirect('/admin')
}

const assignInput = z.object({clientId: z.uuid(), adminEmail: z.email().nullable()})

export async function assignClient(input: z.input<typeof assignInput>): Promise<{ok: boolean; message?: string}> {
  const {supabase, isSuper} = await requireAdmin()
  if (!isSuper) return {ok: false, message: 'Only super admins can reassign clients.'}
  const parsed = assignInput.safeParse(input)
  if (!parsed.success) return {ok: false, message: 'That isn’t a valid admin.'}

  const {data, error} = await supabase
    .from('clients')
    .update({assigned_admin: parsed.data.adminEmail?.toLowerCase() ?? null})
    .eq('id', parsed.data.clientId)
    .select('id')
  if (error || !data?.length) return {ok: false, message: 'Couldn’t reassign the client.'}
  refresh()
  return {ok: true}
}
