/**
 * 戰鬥領域型別與訊息格式
 *
 * 所有共享數值都由老師端（Host）計算，再以 STATE 事件廣播給全班。
 */

import type { Difficulty, Role } from '@/types'

export type BattleStatus = 'running' | 'win' | 'lose'

/** 全班共享的戰鬥狀態 */
export interface BattleState {
  status: BattleStatus
  bossHp: number
  bossHpMax: number
  teamHp: number
  teamHpMax: number
  defenseEnergy: number
  defenseThreshold: number
  ultEnergy: number
  ultThreshold: number
  /** 目前護盾還可吸收的傷害 */
  shieldHp: number
  shieldMax: number
  /** 魔王暈眩到什麼時候（老師端時鐘，epoch ms） */
  bossStunnedUntil: number
  /** 暈眩剩餘秒數 */
  bossStunSec: number
  /** 這場實際套用的魔王攻擊力（含人數平衡） */
  bossAttackPower: number
  /** 魔王名稱（方便畫面顯示） */
  bossName: string
  /** 魔王大招名稱 */
  bossUltName: string
  /** 魔王大招落下的時間（老師端時鐘，epoch ms） */
  bossUltAt: number
  /** 距離魔王大招還有幾秒 */
  bossUltSec: number
  /** 魔王大招的間隔秒數（畫蓄力條用） */
  bossUltIntervalSec: number
  /** 魔王大招的傷害 */
  bossUltPower: number
  /** 是否已經預告過這次大招 */
  bossUltWarned: boolean
  /** 實際套用的平衡係數（1 = 未調整） */
  balanceFactor: number
  /** 已釋放的技能次數 */
  defenseUsed: number
  ultUsed: number
  /** 剩餘時間（秒） */
  remainingSec: number
  totalSec: number
  /** 距離魔王下一次攻擊還有幾秒 */
  nextAttackSec: number
  /** 遊戲結束時間（老師端時鐘，epoch ms） */
  endsAt: number
  /** 魔王下一次攻擊時間（老師端時鐘，epoch ms） */
  nextAttackAt: number
  /** 全隊累積答對 / 答錯題數 */
  totalCorrect: number
  totalWrong: number
}

/** 老師端派給單一學生的題目 */
export interface QuestionPayload {
  /** 這是該生的第幾題 */
  index: number
  questionId: string
  stem: string
  options: string[]
  difficulty: Difficulty
  imageRef?: string
}

/** 學生回報的作答結果 */
export interface AnswerPayload {
  questionId: string
  choiceIndex: number
  seconds: number
}

/** 戰鬥中發生的公開事件（全班都看得到） */
export interface BattleEvent {
  kind:
    | 'damage'
    | 'wrong'
    | 'boss-attack'
    | 'boss-ult-warning'
    | 'boss-ult'
    | 'block'
    | 'skill-defense'
    | 'skill-ult'
    | 'info'
  seatNo?: string
  name?: string
  /** 傷害值或魔王攻擊力 */
  amount?: number
  combo?: number
  text?: string
}

/** 單一學生的戰鬥統計（M5 結算報表會用到） */
export interface PlayerBattleStats {
  seatNo: string
  name: string
  role: Role
  correct: number
  wrong: number
  damage: number
  /** 目前連擊數 */
  combo: number
  maxCombo: number
  /** 累計作答秒數（用來算平均） */
  totalSeconds: number
  /** 為防禦能量貢獻的點數 */
  defenseEnergy: number
  /** 為大招能量貢獻的點數 */
  ultEnergy: number
}
