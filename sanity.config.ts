'use client'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {ChangeUrlAction} from './sanity/actions/changeUrl'
import {lockSlugOnPublish} from './sanity/actions/lockSlugOnPublish'
import {OpenSiteAction} from './sanity/actions/openSite'
import {apiVersion, dataset, projectId} from './sanity/env'
import {schemaTypes} from './sanity/schemaTypes'
import {structure} from './sanity/structure'

const SINGLETONS = new Set(['website'])
const SINGLETON_ACTIONS = new Set(['publish', 'discardChanges', 'restore'])

export default defineConfig({
  name: 'default',
  title: 'Welcome to Vydia',
  basePath: '/studio',
  projectId,
  dataset,
  plugins: [
    structureTool({structure}),
    ...(process.env.NODE_ENV === 'development' ? [visionTool({defaultApiVersion: apiVersion})] : []),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({schemaType}) => !SINGLETONS.has(schemaType)),
  },
  document: {
    actions: (prev, {schemaType}) => {
      if (SINGLETONS.has(schemaType)) return prev.filter(({action}) => action && SINGLETON_ACTIONS.has(action))
      if (schemaType === 'artist') {
        return [
          ...prev.map((action) => (action.action === 'publish' ? lockSlugOnPublish(action) : action)),
          ChangeUrlAction,
          OpenSiteAction,
        ]
      }
      return prev
    },
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global' ? prev.filter((item) => !SINGLETONS.has(item.templateId)) : prev,
  },
})
