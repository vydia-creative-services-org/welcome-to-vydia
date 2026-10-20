import {createImageUrlBuilder, type SanityImageSource} from '@sanity/image-url'
import {dataset, projectId} from '@/sanity/env'
import type {CardCover} from './types'

const builder = createImageUrlBuilder({projectId, dataset})

export const urlFor = (source: SanityImageSource) => builder.image(source).auto('format')

export function coverSource(cover: CardCover): SanityImageSource | null {
  if (!cover.asset) return null
  const {crop, hotspot} = cover
  const fullCrop =
    crop && crop.top !== undefined && crop.bottom !== undefined && crop.left !== undefined && crop.right !== undefined
      ? {top: crop.top, bottom: crop.bottom, left: crop.left, right: crop.right}
      : undefined
  const fullHotspot =
    hotspot &&
    hotspot.x !== undefined &&
    hotspot.y !== undefined &&
    hotspot.width !== undefined &&
    hotspot.height !== undefined
      ? {x: hotspot.x, y: hotspot.y, width: hotspot.width, height: hotspot.height}
      : undefined
  return {asset: {_ref: cover.asset._id}, crop: fullCrop, hotspot: fullHotspot}
}
