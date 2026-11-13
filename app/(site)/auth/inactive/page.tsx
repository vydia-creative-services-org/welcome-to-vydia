import {Notice} from '@/components/Notice'
import {PageShell} from '@/components/PageShell'

export const instant = false

export default async function InactiveLinkPage({searchParams}: PageProps<'/auth/inactive'>) {
  const {reason} = await searchParams
  return (
    <PageShell>
      {reason === 'error' ? (
        <Notice title="Couldn’t Open Your Page">
          Something went wrong on our side. Try the link again in a moment.
        </Notice>
      ) : (
        <Notice title="This Link Is No Longer Active">
          Contact Vydia label services if you still need access to your page.
        </Notice>
      )}
    </PageShell>
  )
}
