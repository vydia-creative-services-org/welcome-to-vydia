const LQIP_WIDTH = 20

export async function makeLqip(image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image)
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * LQIP_WIDTH))
  const canvas = document.createElement('canvas')
  canvas.width = LQIP_WIDTH
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  context.drawImage(bitmap, 0, 0, LQIP_WIDTH, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.6)
}
