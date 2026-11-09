import {HomeIcon} from '@sanity/icons/Home'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {EMAIL_PATTERN} from '../../lib/email'

export const website = defineType({
  name: 'website',
  title: 'Website (global layout)',
  type: 'document',
  icon: HomeIcon,
  groups: [
    {name: 'resources', title: 'Resources', default: true},
    {name: 'access', title: 'Access'},
  ],
  fields: [
    defineField({
      name: 'resources',
      type: 'array',
      group: 'resources',
      description:
        'Shown on every artist page, in this order. Drag to reorder. Artists with a resource override show their own list instead. A resource only shows up on the site once it’s added here (or to an artist’s override).',
      of: [defineArrayMember({type: 'reference', to: [{type: 'resource'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'internalViewerEmails',
      title: 'Internal viewers',
      type: 'array',
      group: 'access',
      description:
        'Vydia people who can view EVERY artist page and sign in with Google or an email link. creativeservices@ and labelservices@ always have access and don’t need to be listed. Removing someone takes effect on their next page load.',
      initialValue: ['erica.johnson@vydia.com', 'mason.omara@vydia.com'],
      of: [
        defineArrayMember({
          type: 'string',
          validation: (rule) =>
            rule.custom<string>((value) =>
              !value || (EMAIL_PATTERN.test(value.trim()) && value.trim().toLowerCase().endsWith('@vydia.com'))
                ? true
                : 'Use a full @vydia.com email address.',
            ),
        }),
      ],
      validation: (rule) =>
        rule.custom<string[]>((list) => {
          const lower = (list ?? []).map((email) => email.trim().toLowerCase())
          return new Set(lower).size === lower.length
            ? true
            : 'This email is listed twice (upper/lower case doesn’t matter).'
        }),
    }),
  ],
  preview: {prepare: () => ({title: 'Website (global layout)'})},
})
