/**
 * 遊戲設定與遊玩紀錄的本機儲存（老師端）
 */

import { loadJson, removeKey, saveJson } from '@/lib/storage/localStore'
import type { GameSettings } from '@/types'
import type { PlayerSlot } from './lobby'

export interface GameSetup {
  roomCode: string
  settings: GameSettings
  createdAt: number
}

function setupKey(roomCode: string): string {
  return `game-setup:${roomCode}`
}

function playersKey(roomCode: string): string {
  return `room-players:${roomCode}`
}

export function saveGameSetup(setup: GameSetup): void {
  saveJson(setupKey(setup.roomCode), setup)
}

export function loadGameSetup(roomCode: string): GameSetup | null {
  return loadJson<GameSetup | null>(setupKey(roomCode), null)
}

export function clearGameSetup(roomCode: string): void {
  removeKey(setupKey(roomCode))
}

/** 記住這次看過的玩家（讓學生離線後老師仍能看到） */
export function saveKnownPlayers(roomCode: string, players: PlayerSlot[]): void {
  saveJson(playersKey(roomCode), players)
}

export function loadKnownPlayers(roomCode: string): PlayerSlot[] {
  return loadJson<PlayerSlot[]>(playersKey(roomCode), [])
}

export function clearKnownPlayers(roomCode: string): void {
  removeKey(playersKey(roomCode))
}
