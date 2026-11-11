import type { ReactNode } from 'react'
import { BG_ASSETS } from '@/lib/assets'

export type SceneTone = 'normal' | 'warning' | 'stunned'

const SKY: Record<SceneTone, string> = {
  normal:
    'linear-gradient(180deg, #1a1140 0%, #241a4a 45%, #120c26 78%, #07040f 100%)',
  warning:
    'linear-gradient(180deg, #3a0f22 0%, #451428 45%, #1e0a16 78%, #07040f 100%)',
  stunned:
    'linear-gradient(180deg, #0d1a45 0%, #14224f 45%, #0a1029 78%, #07040f 100%)',
}

/** 圖層式戰鬥背景：天空 → 月亮 → 雲 → 城堡 → 地面 */
export function BattleScene({
  tone = 'normal',
  children,
  className = '',
}: {
  tone?: SceneTone
  children: ReactNode
  className?: string
}) {
  return (
    <div className={['rpg-scene', className].join(' ')}>
      <div className="rpg-scene__sky" style={{ background: SKY[tone] }} aria-hidden />
      <img className="rpg-scene__moon" src={BG_ASSETS.moon} alt="" aria-hidden />
      <img
        className="rpg-scene__cloud"
        src={BG_ASSETS.cloud1}
        alt=""
        aria-hidden
        style={{ top: '10%', width: 130, animationDuration: '62s' }}
      />
      <img
        className="rpg-scene__cloud"
        src={BG_ASSETS.cloud2}
        alt=""
        aria-hidden
        style={{ top: '26%', width: 92, animationDuration: '88s', animationDelay: '-30s' }}
      />
      <img
        className="rpg-scene__cloud"
        src={BG_ASSETS.cloud3}
        alt=""
        aria-hidden
        style={{ top: '38%', width: 70, animationDuration: '110s', animationDelay: '-64s' }}
      />
      <img className="rpg-scene__castle" src={BG_ASSETS.castle} alt="" aria-hidden style={{ width: '46%', minWidth: 220, maxWidth: 420 }} />
      <div className="rpg-scene__ground" style={{ height: '20%' }} aria-hidden />
      <div className="relative z-10 flex size-full flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}
