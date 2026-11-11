/**
 * 遊戲預設參數與計算公式
 * 對應規劃書第 4 節「遊戲機制設計」
 *
 * 註：標示（可調）的數值皆為初值，M4 會依實測微調。
 */

import type { BossDifficulty, Difficulty, GameSettings, Role } from '@/types'

/** 魔王預設檔（三種難度） */
export interface BossPreset {
  difficulty: BossDifficulty
  name: string
  /** 遊戲時間（秒） */
  durationSec: number
  bossHp: number
  attackIntervalSec: number
  attackPower: number
  /** 魔王大招名稱 */
  ultName: string
}

/**
 * 魔王預設檔（以 30 人為基準推導，可調）
 *
 * 推導邏輯：
 *   30 位學生 × 每 12 秒作答一題 × 65% 正確率 × 平均 75 傷害 ≈ 122 傷害/秒
 *   魔王 HP ≈ 122 × 遊玩時間的 70%，讓戰鬥「打得完但不輕鬆」
 *   魔王攻擊：**完全不動作的團隊，會在時間結束前被打完**。
 *            以隊伍血量的 75% 為目標反推（含魔王大招）：
 *            A × (時間/攻擊間隔 + 大招次數 × 大招倍率) = 隊伍血量 × 0.75
 *
 *   注意：魔王攻擊力**不隨人數縮放**。隊伍血條是固定值，
 *   若攻擊力跟著人數下降，小班就永遠打不死人；只有魔王 HP 與能量門檻
 *   需要隨人數縮放（讓戰鬥長度與技能節奏維持一致）。
 */
export const BOSS_PRESETS: Record<BossDifficulty, BossPreset> = {
  easy: {
    difficulty: 'easy',
    name: '史萊姆王',
    durationSec: 5 * 60,
    bossHp: 26000,
    attackIntervalSec: 14,
    attackPower: 72,
    ultName: '黏液爆發',
  },
  normal: {
    difficulty: 'normal',
    name: '暗影法師',
    durationSec: 8 * 60,
    bossHp: 40000,
    attackIntervalSec: 12,
    attackPower: 40,
    ultName: '封印之霧',
  },
  hard: {
    difficulty: 'hard',
    name: '魔王巴拉摩斯',
    durationSec: 10 * 60,
    bossHp: 52000,
    attackIntervalSec: 10,
    attackPower: 28,
    ultName: '滅世烈焰',
  },
}

/** 依題目難度的基礎傷害（可調） */
export const BASE_DAMAGE: Record<Difficulty, number> = { 1: 30, 2: 60, 3: 100 }

/** 依題目難度的基礎能量（可調） */
export const BASE_ENERGY: Record<Difficulty, number> = { 1: 3, 2: 6, 3: 10 }

/** 角色被動 */
export const ROLE_PASSIVE = {
  /** 戰士：傷害倍率 */
  warriorDamageMultiplier: 1.1,
  /** 牧師：防禦能量倍率 */
  priestDefenseMultiplier: 1.3,
  /** 法師：大招能量倍率 */
  mageUltMultiplier: 1.3,
} as const

/** 連擊加成上限（可調）：每連擊 +10%，最多 +50% */
export const COMBO_BONUS_PER_HIT = 0.1
export const COMBO_BONUS_MAX_HITS = 5

/* ------------------------------------------------------------------ */
/* 技能與平衡（可調）                                                  */
/* ------------------------------------------------------------------ */

/** 平衡計算的參考人數：以上數值都是以這個人數設計的 */
export const REFERENCE_PLAYERS = 30

/** 隊伍血條（固定值，不隨人數縮放） */
export const TEAM_HP = 3000

/** 防禦技能：護盾可吸收的傷害（約可擋 7 次魔王普通攻擊） */
export const DEFENSE_SHIELD = 300
/** 大招：對魔王造成的傷害（約魔王總血量的 7.5%） */
export const ULT_DAMAGE = 3000
/** 大招：魔王暈眩秒數 */
export const ULT_STUN_SEC = 6
/**
 * 能量門檻（以 30 人為基準，代表約 45 秒／75 秒可放一次技能）
 * 註：全隊每秒約產生 10 點能量。
 */
export const DEFENSE_THRESHOLD_REF = 450
export const ULT_THRESHOLD_REF = 750

/* ------------------------------------------------------------------ */
/* 團隊技能名稱（可自由改成自己班級喜歡的招式名）                       */
/* ------------------------------------------------------------------ */

export const TEAM_SKILLS = {
  defense: {
    name: '聖光護盾',
    emoji: '🛡',
    verb: '展開結界',
    hint: '魔王攻擊會先被吸收',
  },
  ult: {
    name: '聖劍大審判',
    emoji: '⚔',
    verb: '斬擊魔王',
    hint: '重創魔王並使其暈眩',
  },
} as const

/** 魔王大招：每隔幾秒放一次、傷害是普通攻擊的幾倍 */
export const BOSS_ULT_INTERVAL_SEC = 90
export const BOSS_ULT_MULTIPLIER = 3
/** 大招落下前幾秒開始預告 */
export const BOSS_ULT_WARN_SEC = 12

/**
 * 依實際人數計算平衡係數。
 *
 * 團隊的答題速度與人數成正比，所以魔王血量、攻擊力與能量門檻
 * 也必須等比縮放，遊戲時間與壓力才會維持一致。
 * 例：5 人的班級所有數值都是 30 人版的 1/6。
 */
export function balanceFactor(playerCount: number): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) return 0.02
  return Math.min(1, Math.max(0.02, playerCount / REFERENCE_PLAYERS))
}

/** 建立一份預設遊戲設定 */
export function createDefaultSettings(
  bossDifficulty: BossDifficulty = 'normal',
  overrides: Partial<GameSettings> = {},
): GameSettings {
  const boss = BOSS_PRESETS[bossDifficulty]
  return {
    className: '',
    bossDifficulty,
    durationSec: boss.durationSec,
    maxPlayers: 40,
    allowLateJoin: true,

    teamHp: TEAM_HP,
    damage: { ...BASE_DAMAGE },
    bossHp: boss.bossHp,
    bossAttackIntervalSec: boss.attackIntervalSec,
    bossAttackPower: boss.attackPower,
    defenseThreshold: DEFENSE_THRESHOLD_REF,
    ultThreshold: ULT_THRESHOLD_REF,
    autoBalance: true,
    autoSkill: true,
    defenseShield: DEFENSE_SHIELD,
    ultDamage: ULT_DAMAGE,
    ultStunSec: ULT_STUN_SEC,
    bossUltIntervalSec: BOSS_ULT_INTERVAL_SEC,
    bossUltMultiplier: BOSS_ULT_MULTIPLIER,
    ...overrides,
  }
}

/** 連擊加成倍率 */
export function comboMultiplier(combo: number): number {
  const hits = Math.min(Math.max(combo, 0), COMBO_BONUS_MAX_HITS)
  return 1 + hits * COMBO_BONUS_PER_HIT
}

/** 計算單次答對的傷害（combo 為「已包含本次」的連擊數） */
export function calcDamage(
  difficulty: Difficulty,
  role: Role,
  combo: number,
  damageTable: Record<Difficulty, number> = BASE_DAMAGE,
): number {
  const base = damageTable[difficulty]
  const roleMul = role === 'warrior' ? ROLE_PASSIVE.warriorDamageMultiplier : 1
  return Math.round(base * comboMultiplier(combo) * roleMul)
}

/** 計算單次答對對「防禦能量」與「大招能量」的貢獻 */
export function calcEnergy(
  difficulty: Difficulty,
  role: Role,
): { defense: number; ult: number } {
  const base = BASE_ENERGY[difficulty]
  return {
    defense: Math.round(base * (role === 'priest' ? ROLE_PASSIVE.priestDefenseMultiplier : 1)),
    ult: Math.round(base * (role === 'mage' ? ROLE_PASSIVE.mageUltMultiplier : 1)),
  }
}
