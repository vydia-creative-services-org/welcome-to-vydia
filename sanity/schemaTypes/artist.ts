import {UserIcon} from '@sanity/icons/User'
import {defineArrayMember, defineField, defineType, type SlugValue, type ValidationContext} from 'sanity'
import {RESERVED_SLUGS, SLUG_PATTERN, slugify} from '../../lib/slug'
import {apiVersion} from '../env'
import {EMAIL_PATTERN} from '../../lib/email'

const isSlugAvailable = async (slug: string, context: ValidationContext) => {
  const published = context.document?._id.replace(/^drafts\./, '') ?? ''
  return context.getClient({apiVersion}).fetch<boolean>(
    `!defined(*[
      _type == "artist" &&
      !(_id in [$draft, $published]) &&
      (slug.current == $slug || $slug in previousSlugs)
    ][0]._id)`,
    {draft: `drafts.${published}`, published, slug},
  )
}

export const artist = defineType({
  name: 'artist',
  title: 'Artist',
  type: 'document',
  icon: UserIcon,
  groups: [
    {name: 'basics', title: 'Basics', default: true},
    {name: 'access', title: 'Access'},
    {name: 'content', title: 'Page content'},
    {name: 'advanced', title: 'Advanced'},
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Artist name',
      type: 'string',
      group: 'basics',
      description: 'Used to generate the URL below. Renaming the artist later does not change the URL.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      group: 'basics',
      description:
        'welcometovydia.com/<this>. Click "Generate" after typing the name. Locked after the first publish because clients bookmark this link. If you really need to change it, use "Change URL…" in the "…" menu next to Publish.',
      options: {source: 'name', slugify, isUnique: () => true},
      readOnly: ({document}) => Boolean(document?.slugLocked),
      validation: (rule) =>
        rule.required().custom<SlugValue>(async (value, context) => {
          const slug = value?.current
          if (!slug) return true
          if (!SLUG_PATTERN.test(slug)) return 'Only lowercase letters, numbers, and single dashes.'
          if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved. Pick another URL.`
          if (!(await isSlugAvailable(slug, context)))
            return 'Another artist already uses this URL (or used it before). Pick a different one.'
          return true
        }),
    }),
    defineField({name: 'slugLocked', type: 'boolean', hidden: true, initialValue: false}),
    defineField({
      name: 'allowedEmails',
      title: 'Allowed emails',
      type: 'array',
      group: 'access',
      description:
        'People who can view this page. They sign in with Google or an email link, no password. Matching ignores upper/lower case. creativeservices@vydia.com, labelservices@vydia.com, and internal viewers (Website → Access) always have access.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: (rule) =>
            rule.custom<string>((value) =>
              !value || EMAIL_PATTERN.test(value.trim()) ? true : 'This doesn’t look like an email address.',
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
    defineField({
      name: 'additionalInfo',
      title: 'Additional info (optional)',
      type: 'blockContent',
      group: 'content',
      description: 'Shown below the resources in grid view, only on this artist’s page.',
    }),
    defineField({
      name: 'resourceOverride',
      title: 'Resource override (optional)',
      type: 'array',
      group: 'content',
      description:
        'If you add ANY resources here, they REPLACE the Website resources on this artist’s page (not added to them). Leave empty to use the Website resources.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'resource'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'previousSlugs',
      title: 'Previous URLs',
      type: 'array',
      group: 'advanced',
      readOnly: true,
      description: 'Old URLs that redirect to the current one. Managed by "Change URL…".',
      of: [defineArrayMember({type: 'string'})],
    }),
  ],
  preview: {
    select: {title: 'name', slug: 'slug.current', emails: 'allowedEmails'},
    prepare: ({title, slug, emails}: {title?: string; slug?: string; emails?: string[]}) => ({
      title,
      subtitle: `/${slug ?? '(no URL yet)'} · ${emails?.length ?? 0} allowed email(s)`,
    }),
  },
})
