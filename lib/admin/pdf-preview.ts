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

export async function renderPdfPreview(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    return await renderFirstPage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function pdfPreviewMessage(error: Error) {
  return error.name === 'PasswordException'
    ? 'This PDF is password-protected, so a preview can’t be generated. The card will use the branded tile instead.'
    : 'Couldn’t render the PDF. The card will use the branded tile instead.'
}
