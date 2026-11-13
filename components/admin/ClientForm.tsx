'use client'
import {Eye, EyeOff, LoaderCircle} from 'lucide-react'
import {unstable_rethrow} from 'next/navigation'
import {useEffect, useMemo, useState, useTransition} from 'react'
import {saveClient, type SaveResult} from '@/app/(admin)/admin/(panel)/clients/actions'
import {draftToInput, type DraftErrors} from '@/lib/admin/drafts'
import type {ClientFormInitial} from '@/lib/admin/form-initial'
import {SITE_URL} from '@/lib/env'
import {groupByCategory} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {cx} from '@/lib/cx'
import {slugify} from '@/lib/slug'
import {clientPayload, type ClientInput} from '@/lib/validation'
import {ConfirmDialog} from './ConfirmDialog'
import controls from './controls.module.css'
import styles from './ClientForm.module.css'
import {EmailRows} from './EmailRows'
import {previewAction, RowActions} from './RowActions'
import {previewHref} from './preview'
import {ResourceThumb} from './ResourceThumb'
import {ResourceEditor} from './ResourceEditor'

type Props = {
  initial: ClientFormInitial
  mainResources: Resource[]
  categories: string[]
}

const siteHost = new URL(SITE_URL).host

export function ClientForm({initial, mainResources, categories}: Props) {
  const isNew = !initial.id
  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [primaryEmail, setPrimaryEmail] = useState(initial.primaryEmail)
  const [auxEmails, setAuxEmails] = useState(initial.auxEmails)
  const [hidden, setHidden] = useState(() => new Set(initial.hiddenResourceIds))
  const [exclusives, setExclusives] = useState(initial.exclusiveResources)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmingSlug, setConfirmingSlug] = useState(false)
  const [saving, startSaving] = useTransition()

  const groups = useMemo(() => groupByCategory(mainResources), [mainResources])
  const mainIds = useMemo(() => new Set(mainResources.map((resource) => resource.id)), [mainResources])
  const slugChanged = !isNew && slug !== initial.slug
  const uploading = exclusives.some((draft) => draft.uploads > 0)

  const draftErrors = useMemo(() => {
    const byId: Partial<Record<string, DraftErrors>> = {}
    exclusives.forEach((draft, index) => {
      const prefix = `exclusiveResources.${index}.`
      const found: DraftErrors = {}
      for (const [key, message] of Object.entries(errors)) {
        if (key.startsWith(prefix)) found[key.slice(prefix.length)] = message
      }
      byId[draft.id] = found
    })
    return byId
  }, [errors, exclusives])

  const buildPayload = (): ClientInput => ({
    id: initial.id,
    name,
    slug,
    emails: [
      {email: primaryEmail, label: 'Client', isPrimary: true},
      ...auxEmails.filter((row) => row.email.trim()).map((row) => ({email: row.email, label: '', isPrimary: false})),
    ],
    hiddenResourceIds: [...hidden].filter((id) => mainIds.has(id)),
    exclusiveResources: exclusives.map(draftToInput),
  })

  const payload = buildPayload()
  const snapshot = JSON.stringify({...payload, hiddenResourceIds: [...(payload.hiddenResourceIds ?? [])].sort()})
  const [baseline] = useState(snapshot)
  const dirty = snapshot !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const submit = () => {
    const parsed = clientPayload.safeParse(payload)
    if (!parsed.success) {
      const found: Record<string, string> = {}
      for (const issue of parsed.error.issues) found[issue.path.join('.')] ??= issue.message
      setErrors(found)
      setFormError(null)
      return
    }
    setErrors({})
    setFormError(null)
    startSaving(async () => {
      try {
        const result: SaveResult = await saveClient(payload)
        setErrors(result.fieldErrors)
        setFormError(result.formError ?? null)
      } catch (error) {
        // A successful save redirects, which rejects this call with a redirect Next has already handled.
        unstable_rethrow(error)
        setFormError('Couldn’t reach the server. Nothing was changed.')
      }
    })
  }

  const toggleHidden = (id: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const onName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (slugChanged) setConfirmingSlug(true)
        else submit()
      }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.requestSubmit()
        }
      }}
    >
      <section className={controls.surface} aria-labelledby="details-title">
        <header className={controls.surfaceHeader}>
          <h2 id="details-title" className={controls.surfaceTitle}>
            Details
          </h2>
        </header>
        <div className={controls.surfaceBody}>
          <div className={controls.field}>
            <label htmlFor="client-name" className={controls.label}>
              Account name
            </label>
            <input
              id="client-name"
              value={name}
              maxLength={100}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'client-name-error' : undefined}
              onChange={(event) => onName(event.target.value)}
              className={controls.input}
            />
            {errors.name && (
              <p id="client-name-error" role="alert" className={controls.error}>
                {errors.name}
              </p>
            )}
          </div>

          <div className={controls.field}>
            <label htmlFor="client-slug" className={controls.label}>
              Link
            </label>
            <div className={controls.inputGroup}>
              <span className={controls.affix}>{siteHost}/</span>
              <input
                id="client-slug"
                value={slug}
                maxLength={60}
                spellCheck={false}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={errors.slug ? 'client-slug-error' : slugChanged ? 'client-slug-warning' : undefined}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value.toLowerCase())
                }}
                className="mono"
              />
            </div>
            {slugChanged && (
              <p id="client-slug-warning" role="status" className={controls.warning}>
                The old link will stop working.
              </p>
            )}
            {errors.slug && (
              <p id="client-slug-error" role="alert" className={controls.error}>
                {errors.slug}
              </p>
            )}
          </div>

          <div className={controls.field}>
            <label htmlFor="client-email" className={controls.label}>
              Email
            </label>
            <input
              id="client-email"
              type="email"
              value={primaryEmail}
              aria-invalid={errors['emails.0.email'] ? true : undefined}
              aria-describedby={errors['emails.0.email'] ? 'client-email-error' : undefined}
              onChange={(event) => setPrimaryEmail(event.target.value)}
              className={controls.input}
            />
            {errors['emails.0.email'] && (
              <p id="client-email-error" role="alert" className={controls.error}>
                {errors['emails.0.email']}
              </p>
            )}
          </div>

          <EmailRows rows={auxEmails} onChange={setAuxEmails} errors={errors} />
          {(errors.emails || errors['emails.0']) && (
            <p role="alert" className={controls.error}>
              {errors.emails ?? errors['emails.0']}
            </p>
          )}
        </div>
      </section>

      {groups.length > 0 && (
        <section className={controls.surface} aria-labelledby="resources-title">
          <header className={controls.surfaceHeader}>
            <h2 id="resources-title" className={controls.surfaceTitle}>
              Resources
            </h2>
          </header>
          <div className={controls.surfaceBody}>
            {groups.map((group) => (
              <div key={group.key} className={styles.group}>
                <h3 className={styles.category}>{group.category}</h3>
                <ul className={controls.rows}>
                  {group.items.map((resource) => {
                    const isHidden = hidden.has(resource.id)
                    const Icon = isHidden ? Eye : EyeOff
                    return (
                      <li key={resource.id} className={controls.row} data-hidden={isHidden || undefined}>
                        <ResourceThumb path={resource.coverImage?.path ?? resource.pdfPreview?.path} />
                        <span className={controls.rowTitle}>{resource.title}</span>
                        <RowActions
                          name={resource.title}
                          actions={[
                            previewAction(previewHref(resource)),
                            {
                              key: 'toggle',
                              label: isHidden ? 'Show' : 'Hide',
                              icon: Icon,
                              onClick: () => toggleHidden(resource.id),
                            },
                          ]}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={controls.surface} aria-labelledby="specific-title">
        <header className={controls.surfaceHeader}>
          <h2 id="specific-title" className={controls.surfaceTitle}>
            Client-Specific Resources
          </h2>
        </header>
        <div className={controls.surfaceBody}>
          <ResourceEditor
            drafts={exclusives}
            setDrafts={setExclusives}
            categories={categories}
            serverErrors={draftErrors}
          />
        </div>
      </section>

      {formError && (
        <p role="alert" className={controls.notice}>
          {formError}
        </p>
      )}

      <div className={styles.saveBar} data-dirty={dirty || undefined}>
        <p className={styles.saveStatus}>{uploading ? 'Uploading files…' : dirty ? 'Unsaved changes' : ''}</p>
        <button
          className={cx(controls.button, controls.primary)}
          data-loading={saving || undefined}
          disabled={saving || uploading}
        >
          {saving && <LoaderCircle aria-hidden size={14} className={controls.spin} />}
          {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingSlug}
        title="Change This Client’s Link?"
        body={`The old link will stop working - send the client the new one: ${siteHost}/${slug}`}
        confirmLabel="Save and change link"
        onCancel={() => setConfirmingSlug(false)}
        onConfirm={() => {
          setConfirmingSlug(false)
          submit()
        }}
      />
    </form>
  )
}
