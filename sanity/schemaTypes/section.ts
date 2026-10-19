import {ThListIcon} from '@sanity/icons/ThList'
import {defineArrayMember, defineField, defineType, type Reference} from 'sanity'

export const section = defineType({
  name: 'section',
  title: 'Section',
  type: 'document',
  icon: ThListIcon,
  fields: [
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required().max(80)}),
    defineField({name: 'subtitle', title: 'Subtitle (optional)', type: 'text', rows: 2}),
    defineField({
      name: 'resources',
      type: 'array',
      description: 'Drag to reorder. Cards appear on the site in this order.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'resource'}]})],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: {
    select: {title: 'title', resources: 'resources'},
    prepare: ({title, resources}: {title?: string; resources?: Reference[]}) => {
      const count = resources?.length ?? 0
      return {title, subtitle: `${count} resource${count === 1 ? '' : 's'}`}
    },
  },
})
