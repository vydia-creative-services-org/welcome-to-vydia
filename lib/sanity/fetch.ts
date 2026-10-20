import 'server-only'
import {cacheLife, cacheTag} from 'next/cache'
import type {ClientReturn, QueryParams} from 'next-sanity'
import {sanity} from './client'

export type SanityTag = 'artist' | 'resource' | 'section' | 'website'

export async function sanityFetch<const Q extends string>(
  query: Q,
  params: QueryParams,
  tags: SanityTag[],
): Promise<ClientReturn<Q, never>> {
  'use cache'
  cacheLife('max')
  cacheTag(...tags)
  return sanity.fetch<ClientReturn<Q, never>>(query, params)
}
