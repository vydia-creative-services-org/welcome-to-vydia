'use client'
import {useMemo, useState, useTransition} from 'react'
import {saveClient, type SaveResult} from '@/app/(admin)/admin/(panel)/clients/actions'
import {typeLabel} from '@/components/TypeLabel'
import {draftToInput, type DraftErrors} from '@/lib/admin/drafts'
import type {ClientFormInitial} from '@/lib/admin/form-initial'
import {SITE_URL} from '@/lib/env'
import {groupByCategory} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {slugify} from '@/lib/slug'
import {clientPayload, type ClientInput} from '@/lib/validation'
import {ConfirmDialog} from './ConfirmDialog'
import controls from './controls.module.css'
import styles from './ClientForm.module.css'
import {EmailRows} from './EmailRows'
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
      ...auxEmails
        .filter((row) => row.email.trim())
        .map((row) => ({email: row.email, label: row.label, isPrimary: false})),
    ],
    hiddenResourceIds: [...hidden].filter((id) => mainIds.has(id)),
    exclusiveResources: exclusives.map(draftToInput),
  })

  const submit = () => {
    const payload = buildPayload()
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
      } catch {
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
    >
      <section className={`${controls.card} ${styles.section}`}>
        <h2 className={controls.legend}>Details</h2>
        <div className={controls.field}>
          <label htmlFor="client-name" className={controls.label}>
            Name
          </label>
          <input
            id="client-name"
            value={name}
            maxLength={100}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => onName(event.target.value)}
            className={controls.input}
          />
          {errors.name && (
            <p role="alert" className={controls.error}>
              {errors.name}
            </p>
          )}
        </div>

        <div className={controls.field}>
          <label htmlFor="client-slug" className={controls.label}>
            Link
          </label>
          <div className={styles.slug}>
            <span className={styles.host}>{siteHost}/</span>
            <input
              id="client-slug"
              value={slug}
              maxLength={60}
              aria-invalid={errors.slug ? true : undefined}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value.toLowerCase())
              }}
              className={controls.input}
            />
          </div>
          {slugChanged && (
            <p role="status" className={controls.error}>
              The old link will stop working.
            </p>
          )}
          {errors.slug && (
            <p role="alert" className={controls.error}>
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
            onChange={(event) => setPrimaryEmail(event.target.value)}
            className={controls.input}
          />
          {errors['emails.0.email'] && (
            <p role="alert" className={controls.error}>
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
      </section>

      {groups.length > 0 && (
        <section className={`${controls.card} ${styles.section}`}>
          <h2 className={controls.legend}>Resources</h2>
          {groups.map((group) => (
            <div key={group.key} className={styles.group}>
              <h3 className={styles.category}>{group.category}</h3>
              <ul className={controls.rows}>
                {group.items.map((resource) => {
                  const isHidden = hidden.has(resource.id)
                  return (
                    <li
                      key={resource.id}
                      className={`${controls.row} ${styles.row}`}
                      data-hidden={isHidden || undefined}
                    >
                      <span className={controls.rowTitle}>{resource.title}</span>
                      <span className={controls.hint}>{typeLabel(resource.type)}</span>
                      <button
                        type="button"
                        className={`${controls.button}`}
                        aria-label={`${isHidden ? 'Restore' : 'Remove'} ${resource.title}`}
                        onClick={() => toggleHidden(resource.id)}
                      >
                        {isHidden ? 'Restore' : 'Remove'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className={`${controls.card} ${styles.section}`}>
        <h2 className={controls.legend}>Client specific</h2>
        <ResourceEditor
          drafts={exclusives}
          setDrafts={setExclusives}
          categories={categories}
          serverErrors={draftErrors}
        />
      </section>

      {formError && (
        <p role="alert" className={controls.notice}>
          {formError}
        </p>
      )}

      <div className={styles.save}>
        <button className={`${controls.button} ${controls.primary}`} disabled={saving || uploading}>
          {saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingSlug}
        title="Change this client’s link?"
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
