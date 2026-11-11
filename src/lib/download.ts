/**
 * 觸發瀏覽器下載檔案
 */

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 稍後再釋放，避免部分瀏覽器下載失敗
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 讀取使用者選擇的文字檔 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('讀取檔案失敗'))
    reader.readAsText(file, 'utf-8')
  })
}
