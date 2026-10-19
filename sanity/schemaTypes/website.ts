import {HomeIcon} from '@sanity/icons/Home'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {EMAIL_PATTERN} from './shared'

export const website = defineType({
  name: 'website',
  title: 'Website (global layout)',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'intro',
      title: 'Intro text',
      type: 'blockContent',
      description: 'Shown on every artist page unless the artist has an intro override.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sections',
      type: 'array',
      description:
        'Default sections, in display order. Artists with a section override show their own sections instead.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'section'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'internalViewerEmails',
      title: 'Internal viewers',
      type: 'array',
      description:
        'Vydia emails that can view EVERY artist page. labelrelationships@ and creativeservices@ always have access and don’t need to be listed.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: (rule) =>
            rule.custom<string>((value) =>
              !value || (EMAIL_PATTERN.test(value.trim()) && value.trim().toLowerCase().endsWith('@vydia.com'))
                ? true
                : 'Must be a valid @vydia.com email',
            ),
        }),
      ],
      validation: (rule) =>
        rule.custom<string[]>((list) => {
          const lower = (list ?? []).map((email) => email.trim().toLowerCase())
          return new Set(lower).size === lower.length ? true : 'Duplicate email (case-insensitive)'
        }),
    }),
  ],
  preview: {prepare: () => ({title: 'Website (global layout)'})},
})
