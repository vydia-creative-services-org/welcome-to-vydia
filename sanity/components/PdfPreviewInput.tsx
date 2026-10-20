import {Button, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback, useEffect, useRef, useState} from 'react'
import {set, useClient, useFormValue, type ImageValue, type ObjectInputProps} from 'sanity'
import {apiVersion} from '../env'

const MAX_PREVIEW_WIDTH = 1200

async function renderFirstPage(url: string): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist')
  const worker = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), {type: 'module'})
  pdfjs.GlobalWorkerOptions.workerPort = worker
  const loadingTask = pdfjs.getDocument({url})
  try {
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({scale: 1})
    const viewport = page.getViewport({scale: Math.min(2, MAX_PREVIEW_WIDTH / base.width)})
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({canvas, viewport}).promise
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the preview'))),
        'image/jpeg',
        0.85,
      ),
    )
  } finally {
    await loadingTask.destroy()
    worker.terminate()
  }
}

const errorMessage = (error: Error) =>
  error.name === 'PasswordException'
    ? 'This PDF is password-protected, so a preview can’t be generated. The card will use the branded tile instead.'
    : 'Couldn’t render the PDF. The card will use the branded tile instead.'

type PdfPreviewValue = ImageValue & {source?: string}

export function PdfPreviewInput(props: ObjectInputProps<PdfPreviewValue>) {
  const {onChange, value, renderDefault} = props
  const client = useClient({apiVersion})
  const fileRefValue = useFormValue(['file', 'asset', '_ref'])
  const typeValue = useFormValue(['type'])
  const fileRef = typeof fileRefValue === 'string' ? fileRefValue : undefined
  const isPdf = typeValue === 'pdf'
  const hasCover = typeof useFormValue(['coverImage', 'asset', '_ref']) === 'string'
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const handledRef = useRef<string | undefined>(value?.asset && value.source === fileRef ? fileRef : undefined)

  const generate = useCallback(
    async (ref: string) => {
      handledRef.current = ref
      setStatus('working')
      try {
        const url = await client.fetch<string | null>('*[_id == $id][0].url', {id: ref})
        if (!url) throw new Error('PDF file not found')
        const blob = await renderFirstPage(url)
        const asset = await client.assets.upload('image', blob, {filename: 'pdf-preview.jpg'})
        onChange(set({_type: 'image', asset: {_type: 'reference', _ref: asset._id}, source: ref}))
        setStatus('idle')
      } catch (error) {
        setMessage(errorMessage(error instanceof Error ? error : new Error(String(error))))
        setStatus('error')
      }
    },
    [client, onChange],
  )

  useEffect(() => {
    if (isPdf && !hasCover && fileRef && handledRef.current !== fileRef) void generate(fileRef)
  }, [isPdf, hasCover, fileRef, generate])

  return (
    <Stack gap={3}>
      {renderDefault(props)}
      <Flex gap={3} align="center">
        <Button
          text={value?.asset ? 'Regenerate from PDF' : 'Generate from PDF'}
          mode="ghost"
          disabled={!fileRef || status === 'working'}
          onClick={() => fileRef && void generate(fileRef)}
        />
        {status === 'working' && <Spinner muted />}
        {status === 'error' && (
          <Text size={1} muted>
            {message}
          </Text>
        )}
      </Flex>
    </Stack>
  )
}
