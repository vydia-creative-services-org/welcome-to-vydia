import {useState} from 'react'
import {useDocumentOperation, type DocumentActionComponent} from 'sanity'
import {currentSlug} from './currentSlug'

export const ChangeUrlAction: DocumentActionComponent = (props) => {
  const {patch} = useDocumentOperation(props.id, props.type)
  const [open, setOpen] = useState(false)
  const doc = props.draft ?? props.published
  const current = currentSlug(doc)
  if (doc?.slugLocked !== true || !current) return null

  return {
    label: 'Change URL…',
    tone: 'caution',
    onHandle: () => setOpen(true),
    dialog: open && {
      type: 'confirm',
      tone: 'caution',
      message: `Clients may have bookmarked /${current}. It will keep working as a redirect to the new URL. After confirming, edit the URL field and publish.`,
      confirmButtonText: 'Unlock URL',
      onCancel: () => setOpen(false),
      onConfirm: () => {
        patch.execute([
          {setIfMissing: {previousSlugs: []}},
          {insert: {after: 'previousSlugs[-1]', items: [current]}},
          {set: {slugLocked: false}},
        ])
        setOpen(false)
      },
    },
  }
}
