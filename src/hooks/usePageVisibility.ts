import { useEffect, useRef } from 'react'

/**
 * 監聽「頁面是否在前景」。
 *
 * 學生切到別的 APP 或分頁時，瀏覽器會把頁面標記為 hidden，
 * 老師端就能顯示「不在分頁」。
 */
export function usePageVisibility(onChange: (hidden: boolean) => void): void {
  const callback = useRef(onChange)
  callback.current = onChange

  useEffect(() => {
    const handler = () => {
      callback.current(document.visibilityState === 'hidden')
    }
    document.addEventListener('visibilitychange', handler)
    // 回報目前的狀態
    handler()
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
}
