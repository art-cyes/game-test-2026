/**
 * 全域型別定義
 * 對應規劃書第 7 節「資料結構」
 */

/** 題目難度：1 簡單 / 2 中等 / 3 困難 */
export type Difficulty = 1 | 2 | 3

/** 魔王難度（= 遊戲長度） */
export type BossDifficulty = 'easy' | 'normal' | 'hard'

/** 角色職業 */
export type Role = 'warrior' | 'priest' | 'mage'

export const ROLE_LABEL: Record<Role, string> = {
  warrior: '戰士',
  priest: '牧師',
  mage: '法師',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: '簡單',
  2: '中等',
  3: '困難',
}

export const BOSS_DIFFICULTY_LABEL: Record<BossDifficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
}

/* ------------------------------------------------------------------ */
/* 題庫                                                                */
/* ------------------------------------------------------------------ */

export interface Question {
  id: string
  subject: string
  unit: string
  difficulty: Difficulty
  /** 題幹 / 題目文字 */
  stem: string
  /** 四個選項 */
  options: [string, string, string, string]
  /** 正解索引 0-3 */
  answerIndex: number
  /** 圖片：外部網址，或 IndexedDB 的 key（見 lib/storage） */
  imageRef?: string
  /** 解析（選填） */
  explanation?: string
}

/* ------------------------------------------------------------------ */
/* 玩家 / 學生                                                         */
/* ------------------------------------------------------------------ */

export interface Student {
  seatNo: string
  name: string
  role: Role
  joinedAt: number
}

/** 遊戲結束後每位學生的統計 */
export interface StudentResult {
  seatNo: string
  name: string
  role: Role
  correct: number
  wrong: number
  total: number
  /** 0 ~ 1 */
  accuracy: number
  damage: number
  defenseEnergy: number
  ultEnergy: number
  /** 平均作答秒數 */
  avgSeconds: number
  maxCombo: number
  /** 在線總秒數 */
  onlineSeconds: number
}

/* ------------------------------------------------------------------ */
/* 遊戲設定 / 紀錄                                                     */
/* ------------------------------------------------------------------ */

export interface GameSettings {
  className: string
  bossDifficulty: BossDifficulty
  /** 遊戲時間（秒）：300 / 480 / 600 */
  durationSec: number
  maxPlayers: number
  allowLateJoin: boolean

  /* --- 進階數值（有預設值，老師可調） --- */
  teamHp: number
  /** 依題目難度決定的基礎傷害 */
  damage: Record<Difficulty, number>
  bossHp: number
  bossAttackIntervalSec: number
  bossAttackPower: number
  /** 累積到多少可釋放防禦技能 */
  defenseThreshold: number
  /** 累積到多少可釋放大招 */
  ultThreshold: number
  /** 依實際人數自動調整魔王強度與能量門檻 */
  autoBalance: boolean
  /** 能量滿了自動釋放技能（老師也可以手動按） */
  autoSkill: boolean
  /** 防禦技能產生的護盾可吸收的傷害 */
  defenseShield: number
  /** 大招對魔王造成的傷害 */
  ultDamage: number
  /** 大招讓魔王暈眩的秒數 */
  ultStunSec: number
  /** 魔王大招的間隔秒數 */
  bossUltIntervalSec: number
  /** 魔王大招傷害 = 普通攻擊 × 此倍率 */
  bossUltMultiplier: number
}

export interface GameRecord {
  id: string
  className: string
  bossDifficulty: BossDifficulty
  startTime: number
  endTime: number
  result: 'win' | 'lose'
  students: StudentResult[]
  settingsSnapshot: GameSettings
}
