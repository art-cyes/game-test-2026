import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  children: ReactNode
  className?: string
  /** 標題右側的裝飾 / 動作 */
  action?: ReactNode
  /** 內凹面板（清單、紀錄用） */
  inset?: boolean
}

/**
 * RPG 風格面板
 * 邊框使用 Kenney「UI Pack - RPG Expansion」的 9-slice 素材（CC0），
 * 內部維持深色底，形成「暗色 RPG UI」。
 */
export function PixelPanel({ title, children, className = '', action, inset = false }: Props) {
  return (
    <section className={['rpg-panel', inset ? 'rpg-panel--inset' : '', className].join(' ')}>
      {title !== undefined && title !== null && (
        <header className="rpg-panel__header">
          <h2 className="rpg-panel__title">{title}</h2>
          {action}
        </header>
      )}
      <div>{children}</div>
    </section>
  )
}
