import { HERO_SPRITES } from '@/lib/assets'
import { SpriteActor } from './SpriteActor'
import type { Role } from '@/types'

export type ActorState = 'idle' | 'attack' | 'cast' | 'hurt'

interface Props {
  role: Role
  state?: ActorState
  /** 面向：front = 正面（第 0 格）、right = 側面朝右（第 3 格） */
  facing?: 'front' | 'right'
  /** 顯示高度（px）；省略時由 className 的 CSS 控制（自適應） */
  size?: number
  className?: string
  title?: string
}

/**
 * 勇者角色（Ninja Adventure 像素 spritesheet）。
 *
 * 注意：角色的 Idle／Attack 圖單列 4 格是「四個面向」（下／上／左／右），
 * 不是動畫，所以固定顯示正面那一格，改用 CSS 讓它呼吸／突刺，
 * 避免看起來在原地轉圈圈。
 *
 *   idle   → 待機（原地輕輕呼吸）
 *   attack → 攻擊（向前突刺）
 *   cast   → 待機 + 金色發光
 *   hurt   → 待機 + 紅閃與震動
 *
 * `facing="right"` 會改用側面朝右那一格（第 3 格），讓勇者面對右邊的魔王。
 */
export function AnimatedHero({ role, state = 'idle', facing = 'front', size, className = '', title }: Props) {
  const set = HERO_SPRITES[role]
  const sheet = state === 'attack' ? set.attack : set.idle
  const frame = facing === 'right' ? 3 : 0
  const cls = [
    state === 'idle' ? 'sprite-actor--bob' : '',
    state === 'attack' ? 'sprite-actor--lunge' : '',
    state === 'cast' ? 'sprite-actor--cast sprite-actor--bob' : '',
    state === 'hurt' ? 'sprite-actor--hurt' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <SpriteActor
      key={state}
      sheet={sheet}
      animate={false}
      frame={frame}
      height={size}
      className={cls}
      title={title ?? role}
    />
  )
}
