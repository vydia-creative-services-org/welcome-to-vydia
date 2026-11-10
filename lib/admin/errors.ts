export type DatabaseError = {code?: string; message: string; details?: string | null}

export type FieldError = {field: string; message: string}

export function mapSaveError(error: DatabaseError): FieldError | null {
  const text = `${error.message} ${error.details ?? ''}`
  if (error.code === '23505' && text.includes('artists_slug_key')) {
    return {field: 'slug', message: 'Another artist already uses this URL. Pick a different one.'}
  }
  if (error.code === '23505' && (text.includes('duplicate email') || text.includes('artist_emails'))) {
    return {field: 'emails', message: 'This email is listed twice.'}
  }
  if (error.code === '23514' && text.includes('artists_slug_check')) {
    return {field: 'slug', message: 'Lowercase letters, numbers, and single hyphens only (and not a reserved word).'}
  }
  if (error.code === '23514' && text.includes('primary email')) {
    return {field: 'emails', message: 'Add a primary email.'}
  }
  return null
}
