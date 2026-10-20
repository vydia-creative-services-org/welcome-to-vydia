import {useDocumentOperation, type DocumentActionComponent} from 'sanity'

export function lockSlugOnPublish(original: DocumentActionComponent): DocumentActionComponent {
  const LockSlugPublishAction: DocumentActionComponent = (props) => {
    const {patch} = useDocumentOperation(props.id, props.type)
    const result = original(props)
    if (!result) return null
    return {
      ...result,
      onHandle: () => {
        if (props.draft && props.draft.slugLocked !== true) patch.execute([{set: {slugLocked: true}}])
        result.onHandle?.()
      },
    }
  }
  LockSlugPublishAction.action = original.action
  return LockSlugPublishAction
}
