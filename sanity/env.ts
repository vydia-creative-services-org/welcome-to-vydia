const sanityProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
if (!sanityProjectId) throw new Error('Missing env var NEXT_PUBLIC_SANITY_PROJECT_ID')

export const projectId = sanityProjectId
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
export const apiVersion = '2025-02-19'
