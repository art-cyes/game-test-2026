/**
 * 圖片壓縮
 *
 * 題目圖片會以 data URL 直接存在題庫裡，並且在戰鬥中傳給學生的手機，
 * 所以必須先壓縮，否則訊息會太大。
 */

const DEFAULT_MAX_SIZE = 640
const DEFAULT_QUALITY = 0.7

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* 退回 <img> 方式 */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取圖片'))
    }
    img.src = url
  })
}

function sourceSize(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ('naturalWidth' in src) return { w: src.naturalWidth, h: src.naturalHeight }
  return { w: src.width, h: src.height }
}

export interface CompressOptions {
  maxSize?: number
  quality?: number
}

/** 把圖片檔轉成壓縮後的 data URL */
export async function fileToCompressedDataUrl(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
  const quality = options.quality ?? DEFAULT_QUALITY

  const bitmap = await loadBitmap(file)
  const { w: width, h: height } = sourceSize(bitmap)
  if (!width || !height) throw new Error('圖片尺寸無效')

  const scale = Math.min(1, maxSize / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('瀏覽器不支援 canvas')

  // 一律轉成 JPEG（體積最可控）。先鋪白底，避免透明區域變成黑色。
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  return canvas.toDataURL('image/jpeg', quality)
}

/** 估算 data URL 的位元組大小 */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const body = dataUrl.slice(comma + 1)
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return Math.floor((body.length * 3) / 4) - padding
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
