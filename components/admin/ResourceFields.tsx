'use client'
import Image from 'next/image'
import {useId} from 'react'
import {dateInputToIso, dateInputValue, type DraftErrors, type ResourceDraft} from '@/lib/admin/drafts'
import {makeLqip} from '@/lib/admin/lqip'
import {pdfPreviewMessage, renderPdfPreview} from '@/lib/admin/pdf-preview'
import {uploadAsset} from '@/lib/admin/upload'
import {fileTypeAllowed, fileTypeMessage, IMAGE_MESSAGE, imageAllowed, mimeFor} from '@/lib/admin/upload-rules'
import {publicImageUrl} from '@/lib/resources/mapping'
import {RESOURCE_TYPES, type ResourceType} from '@/lib/resources/types'
import {CategoryInput} from './CategoryInput'
import controls from './controls.module.css'
import styles from './ResourceFields.module.css'

const URL_PREFIX = 'https://www.'

export type DraftUpdate = (update: (draft: ResourceDraft) => ResourceDraft) => void

type Props = {
  draft: ResourceDraft
  onChange: DraftUpdate
  categories: string[]
  errors: DraftErrors
}

const FILE_ACCEPT: Record<ResourceType, string> = {
  pdf: 'application/pdf,.pdf',
  video: 'video/*,.mp4,.mov,.webm',
  slides: '.pdf,.pptx,.ppt,.key,application/pdf',
  link: '',
}

export function ResourceFields({draft, onChange, categories, errors}: Props) {
  const id = useId()
  const showFile = draft.type !== 'link'
  const showUrl = draft.type === 'link' || draft.type === 'slides'
  const prefixed = !draft.url || draft.url.startsWith(URL_PREFIX)
  const changeUrl = (typed: string) => {
    const value = prefixed && !/^https?:\/\//i.test(typed) ? URL_PREFIX + typed : typed
    // Typed (or pasted) text with its own scheme is kept as-is; clearing it restores the prefix
    onChange((d) => ({...d, url: prefixed && value === URL_PREFIX ? '' : value}))
  }
  const busy = draft.uploads > 0
  const previewPath = draft.coverImage ?? draft.pdfPreview

  const begin = () => onChange((d) => ({...d, uploads: d.uploads + 1, message: null}))
  const settle = (patch: (d: ResourceDraft) => ResourceDraft) =>
    onChange((d) => ({...patch(d), uploads: d.uploads - 1}))

  const changeType = (type: ResourceType) =>
    onChange((d) => ({
      ...d,
      type,
      file: type === 'link' ? null : d.file,
      fileName: type === 'link' ? null : d.fileName,
      url: type === 'pdf' || type === 'video' ? '' : d.url,
      pdfPreview: type === 'pdf' ? d.pdfPreview : null,
      pdfPreviewLqip: type === 'pdf' ? d.pdfPreviewLqip : null,
      message: null,
    }))

  const chooseFile = async (file: File) => {
    const mime = mimeFor(file)
    if (!fileTypeAllowed(draft.type, mime)) {
      onChange((d) => ({...d, message: fileTypeMessage(draft.type, mime)}))
      return
    }
    begin()
    try {
      const path = await uploadAsset({
        resourceId: draft.id,
        kind: 'file',
        resourceType: draft.type,
        file,
        fileName: file.name,
      })
      onChange((d) => ({...d, file: path, fileName: file.name, pdfPreview: null, pdfPreviewLqip: null}))
      let previewMessage: string | null = null
      if (draft.type === 'pdf') {
        try {
          const blob = await renderPdfPreview(file)
          const [lqip, preview] = await Promise.all([
            makeLqip(blob),
            uploadAsset({
              resourceId: draft.id,
              kind: 'preview',
              resourceType: 'pdf',
              file: blob,
              fileName: 'preview.jpg',
            }),
          ])
          onChange((d) => ({...d, pdfPreview: preview, pdfPreviewLqip: lqip}))
        } catch (error) {
          previewMessage = pdfPreviewMessage(error instanceof Error ? error : new Error('preview failed'))
        }
      }
      settle((d) => ({...d, message: previewMessage}))
    } catch (error) {
      settle((d) => ({...d, message: error instanceof Error ? error.message : 'The upload failed.'}))
    }
  }

  const chooseCover = async (file: File) => {
    const mime = mimeFor(file)
    if (!imageAllowed(mime, file.size)) {
      onChange((d) => ({...d, message: IMAGE_MESSAGE}))
      return
    }
    begin()
    try {
      const [lqip, path] = await Promise.all([
        makeLqip(file),
        uploadAsset({resourceId: draft.id, kind: 'cover', resourceType: draft.type, file, fileName: file.name}),
      ])
      settle((d) => ({...d, coverImage: path, coverImageLqip: lqip}))
    } catch (error) {
      settle((d) => ({...d, message: error instanceof Error ? error.message : 'The upload failed.'}))
    }
  }

  return (
    <div className={styles.fields}>
      <div className={controls.field}>
        <label htmlFor={`${id}-title`} className={controls.label}>
          Title
        </label>
        <input
          id={`${id}-title`}
          value={draft.title}
          maxLength={120}
          aria-invalid={errors.title ? true : undefined}
          onChange={(event) => onChange((d) => ({...d, title: event.target.value}))}
          className={controls.input}
        />
        {errors.title && (
          <p role="alert" className={controls.error}>
            {errors.title}
          </p>
        )}
      </div>

      <fieldset className={styles.types}>
        <legend className={controls.label}>Type</legend>
        {RESOURCE_TYPES.map((option) => (
          <label key={option.value} className={styles.radio}>
            <input
              type="radio"
              name={`${id}-type`}
              value={option.value}
              checked={draft.type === option.value}
              onChange={() => changeType(option.value)}
            />
            {option.title}
          </label>
        ))}
      </fieldset>

      {showFile && (
        <div className={controls.field}>
          <label htmlFor={`${id}-file`} className={controls.label}>
            File
          </label>
          {draft.file && (
            <p className={styles.current}>
              <span className={styles.fileName}>{draft.fileName ?? draft.file}</span>
              <button
                type="button"
                className={`${controls.button}`}
                onClick={() =>
                  onChange((d) => ({...d, file: null, fileName: null, pdfPreview: null, pdfPreviewLqip: null}))
                }
              >
                Remove file
              </button>
            </p>
          )}
          <input
            id={`${id}-file`}
            type="file"
            accept={FILE_ACCEPT[draft.type]}
            disabled={busy}
            aria-invalid={errors.file ? true : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void chooseFile(file)
            }}
          />
          {errors.file && (
            <p role="alert" className={controls.error}>
              {errors.file}
            </p>
          )}
        </div>
      )}

      {showUrl && (
        <div className={controls.field}>
          <label htmlFor={`${id}-url`} className={controls.label}>
            URL
          </label>
          <div className={styles.urlRow}>
            {prefixed && <span className={styles.urlPrefix}>{URL_PREFIX}</span>}
            <input
              id={`${id}-url`}
              type={prefixed ? 'text' : 'url'}
              value={prefixed ? draft.url.slice(URL_PREFIX.length) : draft.url}
              aria-invalid={errors.url ? true : undefined}
              onChange={(event) => changeUrl(event.target.value)}
              className={controls.input}
            />
          </div>
          {errors.url && (
            <p role="alert" className={controls.error}>
              {errors.url}
            </p>
          )}
        </div>
      )}

      <div className={controls.field}>
        <label htmlFor={`${id}-cover`} className={controls.label}>
          Cover image
        </label>
        {previewPath && (
          <div className={styles.preview}>
            <Image
              src={publicImageUrl(previewPath)}
              alt=""
              width={96}
              height={96}
              unoptimized
              className={styles.thumb}
            />
            {draft.coverImage && (
              <button
                type="button"
                className={`${controls.button}`}
                onClick={() => onChange((d) => ({...d, coverImage: null, coverImageLqip: null, coverImageAlt: ''}))}
              >
                Remove cover
              </button>
            )}
          </div>
        )}
        <input
          id={`${id}-cover`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void chooseCover(file)
          }}
        />
      </div>

      {draft.coverImage && (
        <div className={controls.field}>
          <label htmlFor={`${id}-alt`} className={controls.label}>
            Alt text
          </label>
          <input
            id={`${id}-alt`}
            value={draft.coverImageAlt}
            onChange={(event) => onChange((d) => ({...d, coverImageAlt: event.target.value}))}
            className={controls.input}
          />
        </div>
      )}

      <div className={controls.field}>
        <label htmlFor={`${id}-category`} className={controls.label}>
          Category
        </label>
        <CategoryInput
          id={`${id}-category`}
          value={draft.category}
          onChange={(category) => onChange((d) => ({...d, category}))}
          categories={categories}
          invalid={Boolean(errors.category)}
        />
        {errors.category && (
          <p role="alert" className={controls.error}>
            {errors.category}
          </p>
        )}
      </div>

      <div className={controls.field}>
        <label htmlFor={`${id}-added`} className={controls.label}>
          Added on
        </label>
        <input
          id={`${id}-added`}
          type="date"
          value={dateInputValue(draft.addedOn)}
          onChange={(event) => onChange((d) => ({...d, addedOn: dateInputToIso(event.target.value)}))}
          className={controls.input}
        />
      </div>

      {busy && (
        <p role="status" className={controls.hint}>
          Uploading…
        </p>
      )}
      {draft.message && (
        <p role="alert" className={controls.notice}>
          {draft.message}
        </p>
      )}
    </div>
  )
}
