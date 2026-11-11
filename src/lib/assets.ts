/**
 * 美術素材對照表
 *
 * 角色／怪物／Boss／背景音效來源：
 *   Ninja Adventure Asset Pack（作者 Pixel-Boy × AAA，CC0 1.0 公眾領域）
 *   https://pixel-boy.itch.io/ninja-adventure-asset-pack
 *   可自由商用、修改、再散布，無需標註。
 *
 * RPG 面板／血條／背景圖層來源：
 *   Kenney（CC0 公眾領域）ui-pack-rpg-expansion / background-elements
 *
 * 詳細出處與授權見 README 的「素材來源」章節。
 */

import type { BossDifficulty, Role } from '@/types'

export const UI_ASSETS = {
  panel: '/assets/ui/panel.png',
  panelInset: '/assets/ui/panel-inset.png',
  btnLong: '/assets/ui/btn-long.png',
  btnLongPressed: '/assets/ui/btn-long-pressed.png',
  iconCheck: '/assets/ui/icon-check.png',
  iconCross: '/assets/ui/icon-cross.png',
} as const

export type BarColor = 'red' | 'green' | 'blue' | 'yellow' | 'back'

/** 三段式血條素材（左端／可平鋪中段／右端） */
export const BAR_ASSETS: Record<BarColor, { l: string; m: string; r: string }> = {
  red: { l: '/assets/ui/bar-red-l.png', m: '/assets/ui/bar-red-m.png', r: '/assets/ui/bar-red-r.png' },
  green: {
    l: '/assets/ui/bar-green-l.png',
    m: '/assets/ui/bar-green-m.png',
    r: '/assets/ui/bar-green-r.png',
  },
  blue: {
    l: '/assets/ui/bar-blue-l.png',
    m: '/assets/ui/bar-blue-m.png',
    r: '/assets/ui/bar-blue-r.png',
  },
  yellow: {
    l: '/assets/ui/bar-yellow-l.png',
    m: '/assets/ui/bar-yellow-m.png',
    r: '/assets/ui/bar-yellow-r.png',
  },
  back: {
    l: '/assets/ui/bar-back-l.png',
    m: '/assets/ui/bar-back-m.png',
    r: '/assets/ui/bar-back-r.png',
  },
}

/** 一張橫向排列的動畫 spritesheet 的描述 */
export interface SpriteSheet {
  /** 圖片路徑 */
  src: string
  /** 每一格的原始寬度（px） */
  fw: number
  /** 每一格的原始高度（px） */
  fh: number
  /** 這張圖有幾格（單列） */
  frames: number
  /** 播放速度（每秒幾格） */
  fps: number
}

/** 一個角色/Boss 的各動作 spritesheet */
export interface ActorSprites {
  idle: SpriteSheet
  attack: SpriteSheet
  hurt: SpriteSheet
  /** 38×38 表情頭像 */
  face: string
}

/**
 * 勇者三人組（Actor/Character，16×16 像素，單列 4 格）。
 *   warrior → Knight（綠甲騎士）
 *   priest  → Monk（修行僧）
 *   mage    → NinjaMageBlack（黑袍法師）
 */
export const HERO_SPRITES: Record<Role, ActorSprites> = {
  warrior: {
    idle: { src: '/assets/na/hero/warrior-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    attack: { src: '/assets/na/hero/warrior-attack.png', fw: 16, fh: 16, frames: 4, fps: 12 },
    hurt: { src: '/assets/na/hero/warrior-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    face: '/assets/na/hero/warrior-face.png',
  },
  priest: {
    idle: { src: '/assets/na/hero/priest-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    attack: { src: '/assets/na/hero/priest-attack.png', fw: 16, fh: 16, frames: 4, fps: 12 },
    hurt: { src: '/assets/na/hero/priest-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    face: '/assets/na/hero/priest-face.png',
  },
  mage: {
    idle: { src: '/assets/na/hero/mage-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    attack: { src: '/assets/na/hero/mage-attack.png', fw: 16, fh: 16, frames: 4, fps: 12 },
    hurt: { src: '/assets/na/hero/mage-idle.png', fw: 16, fh: 16, frames: 4, fps: 6 },
    face: '/assets/na/hero/mage-face.png',
  },
}

/**
 * 三隻魔王（Actor/Boss，幀數與尺寸依素材而不同）。
 *   easy   → GiantSlime（巨大史萊姆）
 *   normal → DemonCyclop（獨眼惡魔）
 *   hard   → TenguRed（紅天狗）
 */
export const BOSS_SPRITES: Record<BossDifficulty, ActorSprites> = {
  easy: {
    idle: { src: '/assets/na/boss/slime-idle.png', fw: 62, fh: 52, frames: 5, fps: 6 },
    attack: { src: '/assets/na/boss/slime-attack.png', fw: 62, fh: 52, frames: 13, fps: 14 },
    hurt: { src: '/assets/na/boss/slime-hurt.png', fw: 62, fh: 52, frames: 5, fps: 10 },
    face: '/assets/na/boss/slime-face.png',
  },
  normal: {
    idle: { src: '/assets/na/boss/cyclop-idle.png', fw: 50, fh: 50, frames: 5, fps: 6 },
    attack: { src: '/assets/na/boss/cyclop-attack.png', fw: 50, fh: 50, frames: 6, fps: 9 },
    hurt: { src: '/assets/na/boss/cyclop-hurt.png', fw: 50, fh: 50, frames: 3, fps: 8 },
    face: '/assets/na/boss/cyclop-face.png',
  },
  hard: {
    idle: { src: '/assets/na/boss/tengu-idle.png', fw: 82, fh: 82, frames: 6, fps: 6 },
    attack: { src: '/assets/na/boss/tengu-attack.png', fw: 82, fh: 82, frames: 15, fps: 14 },
    hurt: { src: '/assets/na/boss/tengu-hurt.png', fw: 82, fh: 82, frames: 8, fps: 10 },
    face: '/assets/na/boss/tengu-face.png',
  },
}

/** 戰鬥背景（Kenney CC0：城堡、月亮、雲） */
export const BG_ASSETS = {
  castle: '/assets/bg/castle.png',
  castleWall: '/assets/bg/castle-wall.png',
  moon: '/assets/bg/moon.png',
  cloud1: '/assets/bg/cloud1.png',
  cloud2: '/assets/bg/cloud2.png',
  cloud3: '/assets/bg/cloud3.png',
} as const
