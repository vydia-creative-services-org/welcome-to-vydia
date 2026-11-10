# Sanity contract (frozen)

Sanity is no longer used at runtime. This folder keeps one file, `schema.json`, which is the frozen field contract for resources.

The Supabase schema, the TypeScript types (`lib/resources`), the validation (`lib/validation.ts`), and the one-time migration (`scripts/migrate-sanity.ts`) all map to it 1:1: same field names, same allowed types, same required and optional rules.

Change `schema.json` only together with all of those, and keep `tests/schema-parity.test.ts` passing. It fails if a Sanity resource field has no mapping.
