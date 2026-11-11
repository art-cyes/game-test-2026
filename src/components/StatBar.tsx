import type { ReactNode } from 'react'
import { BAR_ASSETS, type BarColor } from '@/lib/assets'

type Size = 'sm' | 'md' | 'lg'

const HEIGHT: Record<Size, number> = { sm: 14, md: 20, lg: 30 }

/** 相容舊介面：把 Tailwind 顏色類別對應到素材顏色 */
const COLOR_MAP: Record<string, BarColor> = {
  'bg-hp': 'red',
  'bg-guard': 'green',
  'bg-mana': 'blue',
  'bg-gold': 'yellow',
}

interface Props {
  label?: ReactNode
  value: number
  max: number
  /** 舊介面的顏色類別（bg-hp / bg-guard / bg-mana / bg-gold） */
  colorClass?: string
  /** 直接指定素材顏色 */
  color?: BarColor
  size?: Size
  /** 是否顯示「數值 / 上限」 */
  showNumbers?: boolean
  /** 數值滿了會發光提示 */
  highlightFull?: boolean
  className?: string
  /** 文字大小（投影畫面用 xl） */
  textSize?: 'md' | 'xl'
}

function barBackground(color: BarColor): React.CSSProperties {
  const a = BAR_ASSETS[color]
  return {
    backgroundImage: `url(${a.l}), url(${a.r}), url(${a.m})`,
    backgroundPosition: 'left center, right center, left center',
    backgroundRepeat: 'no-repeat, no-repeat, repeat-x',
    backgroundSize: '9px 100%, 9px 100%, 18px 100%',
    imageRendering: 'pixelated',
  }
}

/** RPG 風格血條（三段式素材：左端／可平鋪中段／右端） */
export function StatBar({
  label,
  value,
  max,
  colorClass = 'bg-hp',
  color,
  size = 'md',
  showNumbers = false,
  highlightFull = false,
  className = '',
  textSize = 'md',
}: Props) {
  const safeMax = max > 0 ? max : 1
  const ratio = Math.max(0, Math.min(1, value / safeMax))
  const full = highlightFull && ratio >= 1
  const tone: BarColor = color ?? COLOR_MAP[colorClass] ?? 'red'
  const labelCls = textSize === 'xl' ? 'rpg-label rpg-label--xl' : 'rpg-label'
  const numberCls = textSize === 'xl' ? 'rpg-number rpg-number--xl' : 'rpg-number'

  return (
    <div className={className}>
      {(label !== undefined || showNumbers) && (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {label !== undefined && <span className={labelCls}>{label}</span>}
          {showNumbers && (
            <span className={numberCls}>
              {Math.round(value)} / {Math.round(max)}
            </span>
          )}
        </div>
      )}
      <div
        className={['rpg-bar', full ? 'rpg-bar--full' : ''].join(' ')}
        style={{ height: HEIGHT[size] }}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeMax)}
      >
        <div className="rpg-bar__track" style={barBackground('back')} />
        <div
          className="rpg-bar__fill"
          style={{ width: `${ratio * 100}%`, ...barBackground(tone) }}
        />
      </div>
    </div>
  )
}
