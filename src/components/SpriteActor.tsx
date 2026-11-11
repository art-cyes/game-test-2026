import type { CSSProperties } from 'react'
import type { SpriteSheet } from '@/lib/assets'

interface Props {
  sheet: SpriteSheet
  /** 播放一次並停在最後一格（攻擊、受擊等一次性動作） */
  once?: boolean
  /**
   * 是否逐格播放。
   * 有些 spritesheet（例如 Ninja Adventure 的角色 Idle／Attack）單列 4 格
   * 其實是「四個面向」而不是動畫，這種就要設 false，只顯示 `frame` 指定的那一格。
   */
  animate?: boolean
  /** `animate=false` 時要顯示第幾格（預設第 0 格） */
  frame?: number
  /** 顯示高度（px）；省略時交給 className（自適應）控制 */
  height?: number
  /** 顯示寬度（px）；省略時交給 className（自適應）控制 */
  width?: number
  className?: string
  title?: string
}

/**
 * 顯示 spritesheet 的像素角色。
 *
 * 播放原理：把整張圖橫向放大 `frames` 倍放進一個 overflow:hidden 的框，
 * 再用 CSS `steps()` 逐格平移（用百分比，所以外框可隨視窗自適應）。
 * 若 `animate=false`，則固定顯示某一格（給「四個面向」的圖用）。
 */
export function SpriteActor({
  sheet,
  once = false,
  animate = true,
  frame = 0,
  height,
  width,
  className = '',
  title,
}: Props) {
  const { src, fw, fh, frames, fps } = sheet
  const playing = animate && frames > 1

  // 循環：走完 frames 格；一次：走 frames-1 步後停在最後一格
  const steps = once ? Math.max(1, frames - 1) : frames
  const end = once ? `${(-(frames - 1) * 100) / frames}%` : '-100%'
  const duration = `${(frames / Math.max(1, fps)).toFixed(3)}s`

  const size: CSSProperties = height !== undefined ? { height } : width !== undefined ? { width } : {}

  return (
    <span
      className={[
        'sprite-actor',
        !playing ? 'sprite-actor--still' : '',
        once && playing ? 'sprite-actor--once' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ...size, aspectRatio: `${fw} / ${fh}` }}
      role="img"
      aria-label={title ?? ''}
    >
      <img
        className="sprite-actor__sheet"
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        style={
          {
            '--sprite-cols': frames,
            '--sprite-steps': steps,
            '--sprite-end': end,
            '--sprite-dur': duration,
            // 靜止時直接鎖定某一格（動畫會覆蓋 inline transform，所以播放時不設）
            transform: playing ? undefined : `translateX(${(-frame * 100) / frames}%)`,
          } as CSSProperties
        }
      />
    </span>
  )
}
