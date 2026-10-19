import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  },
  schemaExtraction: {
    path: './sanity/schema.json',
  },
  typegen: {
    path: './{app,components,lib}/**/*.{ts,tsx}',
    schema: './sanity/schema.json',
    generates: './lib/sanity/types.generated.ts',
  },
})
