/**
 * 音效引擎
 *
 * 音效／BGM：使用 Ninja Adventure Asset Pack（CC0 公眾領域）的 wav / ogg 音檔。
 *      檔案載入失敗時會退回即時合成的 8-bit 音效，BGM 也會退回合成 chiptune。
 * 勝敗樂句：維持自製的約 5 秒管弦風格號角（不在素材包內）。
 *
 * 行動裝置政策：AudioContext 必須在使用者互動後才能發聲，
 * 所以畫面要提供「點擊開始」的入口（見 unlockAudio）。
 */

import { useSyncExternalStore } from 'react'

export type SfxName =
  | 'click'
  | 'correct'
  | 'wrong'
  | 'bossAttack'
  | 'bossUltWarning'
  | 'bossUlt'
  | 'block'
  | 'skillDefense'
  | 'skillUlt'
  | 'win'
  | 'lose'

/** 音效可堆疊多層（例如「揮劍 + 命中」），delay 單位為秒 */
interface SfxLayer {
  src: string
  delay?: number
  gain?: number
}

const SFX_FILES: Record<SfxName, SfxLayer[]> = {
  click: [{ src: '/assets/na/audio/click.wav', gain: 0.5 }],
  // 答對：揮劍聲 + 命中聲
  correct: [
    { src: '/assets/na/audio/slash.wav', gain: 0.5 },
    { src: '/assets/na/audio/hit.wav', delay: 0.07, gain: 0.55 },
  ],
  wrong: [{ src: '/assets/na/audio/wrong.wav', gain: 0.6 }],
  bossAttack: [{ src: '/assets/na/audio/boss-attack.wav', gain: 0.7 }],
  bossUltWarning: [{ src: '/assets/na/audio/warning.wav', gain: 0.6 }],
  bossUlt: [{ src: '/assets/na/audio/boss-ult.wav', gain: 0.75 }],
  block: [{ src: '/assets/na/audio/block.wav', gain: 0.7 }],
  skillDefense: [{ src: '/assets/na/audio/shield.wav', gain: 0.7 }],
  // 大招：劍擊 + 魔法爆裂
  skillUlt: [
    { src: '/assets/na/audio/slash2.wav', gain: 0.45 },
    { src: '/assets/na/audio/skill.wav', delay: 0.05, gain: 0.7 },
  ],
  win: [{ src: '/assets/na/audio/click.wav', gain: 0.6 }],
  lose: [{ src: '/assets/na/audio/wrong.wav', gain: 0.6 }],
}

/** 戰鬥 BGM（Ninja Adventure「17 - Fight」，CC0） */
const BGM_FILE = '/assets/audio/bgm-battle.ogg'

/* ------------------------------------------------------------------ */
/* 勝利 / 失敗樂句（約 5 秒，自製管弦風格）                            */
/* ------------------------------------------------------------------ */

interface FanfareNote {
  /** 頻率 (Hz) */
  f: number
  /** 何時開始（秒） */
  at: number
  /** 持續長度（秒） */
  dur: number
  /** 音量 */
  g?: number
  /** 是否加低八度加厚 */
  thick?: boolean
}

const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.5, G6: 1568.0,
  A3: 220.0, C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0, A2: 110.0,
} as const

/** 勝利：C 大調、上行號角 + 收尾大和弦（歡樂） */
const WIN_FANFARE: FanfareNote[] = [
  { f: N.C5, at: 0.0, dur: 0.16, g: 0.4 },
  { f: N.C5, at: 0.18, dur: 0.16, g: 0.4 },
  { f: N.C5, at: 0.36, dur: 0.16, g: 0.4 },
  { f: N.E5, at: 0.54, dur: 0.5, g: 0.45 },
  { f: N.E5, at: 1.06, dur: 0.16, g: 0.42 },
  { f: N.D5, at: 1.24, dur: 0.16, g: 0.42 },
  { f: N.E5, at: 1.42, dur: 0.16, g: 0.42 },
  { f: N.F5, at: 1.60, dur: 0.5, g: 0.45 },
  { f: N.G5, at: 2.14, dur: 0.85, g: 0.5, thick: true },
  { f: N.C4, at: 2.14, dur: 0.85, g: 0.28, thick: true },
  // 收尾大和弦
  { f: N.C5, at: 3.10, dur: 1.9, g: 0.34 },
  { f: N.E5, at: 3.10, dur: 1.9, g: 0.3 },
  { f: N.G5, at: 3.10, dur: 1.9, g: 0.3 },
  { f: N.C6, at: 3.10, dur: 1.9, g: 0.26 },
  { f: N.C3, at: 3.10, dur: 1.9, g: 0.34, thick: true },
  { f: N.G3, at: 3.10, dur: 1.9, g: 0.2 },
]

/** 失敗：A 小調、下行嘆息 + 低沉小和弦（哀傷） */
const LOSE_FANFARE: FanfareNote[] = [
  { f: N.A4, at: 0.0, dur: 0.5, g: 0.4 },
  { f: N.G4, at: 0.5, dur: 0.5, g: 0.38 },
  { f: N.F4, at: 1.0, dur: 0.5, g: 0.38 },
  { f: N.E4, at: 1.5, dur: 0.55, g: 0.38 },
  { f: N.D4, at: 2.1, dur: 0.65, g: 0.36 },
  { f: N.C4, at: 2.8, dur: 0.7, g: 0.36 },
  { f: N.A3, at: 3.5, dur: 1.5, g: 0.34, thick: true },
  { f: N.C4, at: 3.5, dur: 1.5, g: 0.28 },
  { f: N.E4, at: 3.5, dur: 1.5, g: 0.26 },
  { f: N.A2, at: 3.5, dur: 1.5, g: 0.32, thick: true },
]

const ENABLED_KEY = 'pixel-heroes:audio-enabled'

/* ------------------------------------------------------------------ */
/* 開關狀態（讓 React 可以訂閱）                                       */
/* ------------------------------------------------------------------ */

let enabled = (() => {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
})()

const listeners = new Set<() => void>()

export function isAudioEnabled(): boolean {
  return enabled
}

export function setAudioEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(ENABLED_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (!next) engine.stopBgm()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useAudioEnabled(): boolean {
  return useSyncExternalStore(subscribe, isAudioEnabled, isAudioEnabled)
}

/* ------------------------------------------------------------------ */
/* 戰鬥 BGM：Am - F - C - G，8 分音符 @132 BPM                        */
/* ------------------------------------------------------------------ */

const STEP_SEC = 60 / 132 / 2
const STEPS_PER_CHORD = 16
/** [根音頻率, 三度音程, 五度音程] */
const CHORDS: [number, number, number][] = [
  [220.0, 3, 7], // Am
  [174.61, 4, 7], // F
  [261.63, 4, 7], // C
  [196.0, 4, 7], // G
]
const TOTAL_STEPS = CHORDS.length * STEPS_PER_CHORD

const LEAD_A = [0, 4, 7, 4, 12, 7, 4, 2]
const LEAD_B = [0, 4, 7, 12, 10, 7, 4, 0]

/** 半音 → 頻率 */
function semi(base: number, n: number): number {
  return base * Math.pow(2, n / 12)
}

/** 某一步要彈的音（回傳音高與聲部） */
interface BgmNote {
  freq: number
  voice: 'lead' | 'bass' | 'arp'
  gain: number
  len: number
}

function bgmStep(step: number): BgmNote[] {
  const s = step % TOTAL_STEPS
  const chordIdx = Math.floor(s / STEPS_PER_CHORD)
  const local = s % STEPS_PER_CHORD
  const [root, , fifth] = CHORDS[chordIdx]
  const notes: BgmNote[] = []

  // 主旋律（高八度）
  const motif = local < 8 ? LEAD_A : LEAD_B
  const semis = motif[local % 8]
  notes.push({
    freq: semi(root * 2, semis),
    voice: 'lead',
    gain: 0.17,
    len: STEP_SEC * 0.9,
  })

  // 貝斯
  if (local === 0 || local === 8) {
    notes.push({ freq: semi(root, -12), voice: 'bass', gain: 0.34, len: STEP_SEC * 1.9 })
  } else if (local === 4 || local === 12) {
    notes.push({ freq: semi(root, 0), voice: 'bass', gain: 0.26, len: STEP_SEC * 1.2 })
  }

  // 琶音（弱）
  if (local % 4 === 2) {
    const tone = [0, fifth, 12][(local / 2) % 3]
    notes.push({ freq: semi(root * 2, tone), voice: 'arp', gain: 0.07, len: STEP_SEC * 0.5 })
  }

  return notes
}

/* ------------------------------------------------------------------ */
/* 合成引擎                                                            */
/* ------------------------------------------------------------------ */

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bgmGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private buffers = new Map<string, AudioBuffer>()
  private preloading = false
  private preloaded = false
  private bgmBuffer: AudioBuffer | null = null
  private bgmSource: AudioBufferSourceNode | null = null
  private bgmLoading = false
  private bgmTimer: ReturnType<typeof setInterval> | null = null
  private bgmStep = 0
  private nextNoteAt = 0

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (this.ctx) return this.ctx
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.ctx.destination)
    this.bgmGain = this.ctx.createGain()
    this.bgmGain.gain.value = 0.5
    this.bgmGain.connect(this.master)
    return this.ctx
  }

  /** 必須在使用者互動時呼叫，才能在手機上發聲 */
  unlock(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    void this.preloadSfx()
  }

  /** 預先解碼所有音效檔（失敗就繼續用合成音） */
  private async preloadSfx(): Promise<void> {
    if (this.preloading || this.preloaded) return
    const ctx = this.ensure()
    if (!ctx) return
    this.preloading = true
    const sources = new Set<string>()
    for (const layers of Object.values(SFX_FILES)) {
      for (const l of layers) sources.add(l.src)
    }
    await Promise.all(
      [...sources].map(async (src) => {
        try {
          const res = await fetch(src)
          if (!res.ok) return
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
          this.buffers.set(src, buffer)
        } catch {
          /* 忽略：播放時會退回合成音 */
        }
      }),
    )
    this.preloaded = true
    this.preloading = false
  }

  /** 載入 BGM（比較大，等真的開戰才抓） */
  private async loadBgm(): Promise<void> {
    const ctx = this.ensure()
    if (!ctx || this.bgmBuffer || this.bgmLoading) return
    this.bgmLoading = true
    try {
      const res = await fetch(BGM_FILE)
      if (res.ok) {
        this.bgmBuffer = await ctx.decodeAudioData(await res.arrayBuffer())
        // 檔案就緒後，把合成 BGM 換掉
        if (this.bgmTimer) {
          this.stopSynthBgm()
          this.startFileBgm()
        }
      }
    } catch {
      /* 失敗就繼續用合成 BGM */
    }
    this.bgmLoading = false
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer
    const length = Math.floor(ctx.sampleRate * 0.5)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer
    return buffer
  }

  private playBuffer(buffer: AudioBuffer, gain: number, delay = 0, destination?: AudioNode): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(destination ?? this.master)
    src.start(ctx.currentTime + delay)
  }

  /* ---------------- 合成音（備援） ---------------- */

  private tone(
    freq: number,
    duration: number,
    options: {
      type?: OscillatorType
      gain?: number
      at?: number
      slideTo?: number
      destination?: AudioNode
    } = {},
  ): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const { type = 'square', gain = 0.5, at = 0, slideTo, destination } = options
    const start = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration)
    }
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(gain, start + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(g)
    g.connect(destination ?? this.master)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  }

  private noiseHit(duration: number, gain: number, at = 0, lowpass = 1200): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const start = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(start)
    src.stop(start + duration)
  }

  private synth(name: SfxName): void {
    switch (name) {
      case 'click':
        this.tone(660, 0.06, { gain: 0.3 })
        break
      case 'correct':
        this.tone(659, 0.08, { gain: 0.42 })
        this.tone(988, 0.12, { gain: 0.38, at: 0.07 })
        break
      case 'wrong':
        this.tone(220, 0.16, { type: 'sawtooth', gain: 0.36, slideTo: 110 })
        break
      case 'bossAttack':
        this.tone(140, 0.3, { gain: 0.5, slideTo: 50 })
        this.noiseHit(0.28, 0.4)
        break
      case 'bossUltWarning':
        this.tone(880, 0.16, { gain: 0.34 })
        this.tone(660, 0.2, { gain: 0.34, at: 0.2 })
        break
      case 'bossUlt':
        this.tone(90, 0.7, { type: 'sawtooth', gain: 0.55, slideTo: 35 })
        this.noiseHit(0.6, 0.5)
        break
      case 'block':
        this.tone(520, 0.12, { type: 'triangle', gain: 0.42, slideTo: 260 })
        break
      case 'skillDefense':
        this.tone(300, 0.4, { type: 'triangle', gain: 0.4, slideTo: 900 })
        break
      case 'skillUlt':
        this.tone(200, 0.5, { gain: 0.45, slideTo: 1400 })
        this.noiseHit(0.45, 0.35, 0.05)
        break
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { gain: 0.4, at: i * 0.13 }))
        break
      case 'lose':
        ;[392, 330, 262, 196].forEach((f, i) =>
          this.tone(f, 0.24, { type: 'triangle', gain: 0.4, at: i * 0.18 }),
        )
        break
    }
  }

  /** 勝利／失敗樂句（約 5 秒） */
  playFanfare(result: 'win' | 'lose'): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    if (ctx.state === 'suspended') void ctx.resume()

    const notes = result === 'win' ? WIN_FANFARE : LOSE_FANFARE
    for (const n of notes) {
      // 主音：鋸齒波（銅管感）
      this.tone(n.f, n.dur, { type: 'sawtooth', gain: (n.g ?? 0.35) * 0.7, at: n.at })
      // 加一層方波讓音色更厚
      this.tone(n.f, n.dur, { type: 'square', gain: (n.g ?? 0.35) * 0.35, at: n.at })
      if (n.thick) {
        this.tone(n.f / 2, n.dur, { type: 'triangle', gain: (n.g ?? 0.35) * 0.6, at: n.at })
      }
    }

    if (result === 'win') {
      // 開頭小鼓滾奏 + 高點鈸 + 低音鼓
      for (let i = 0; i < 8; i += 1) this.noiseHit(0.05, 0.1 + i * 0.01, i * 0.06, 5000)
      this.noiseHit(0.7, 0.3, 2.14, 9000)
      this.tone(70, 0.7, { type: 'sine', gain: 0.45, at: 2.14, slideTo: 40 })
      this.noiseHit(0.5, 0.25, 3.1, 7000)
    } else {
      this.tone(55, 1.8, { type: 'sine', gain: 0.35, at: 3.5, slideTo: 32 })
    }
  }

  play(name: SfxName): void {
    if (!enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    // 勝敗改成自製的 5 秒樂句
    if (name === 'win' || name === 'lose') {
      this.playFanfare(name)
      return
    }
    void this.preloadSfx()

    const layers = SFX_FILES[name]
    const loaded = layers.filter((l) => this.buffers.has(l.src))
    if (loaded.length > 0) {
      for (const l of loaded) {
        this.playBuffer(this.buffers.get(l.src)!, l.gain ?? 0.6, l.delay ?? 0)
      }
      return
    }
    this.synth(name)
  }

  /* ---------------- BGM ---------------- */

  startBgm(): void {
    if (!enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.bgmGain) return
    if (ctx.state === 'suspended') void ctx.resume()

    if (this.bgmBuffer) {
      this.startFileBgm()
      return
    }
    // 音樂檔還沒好：先用合成 BGM 頂著，同時在背景載入
    this.startSynthBgm()
    void this.loadBgm()
  }

  private startFileBgm(): void {
    const ctx = this.ctx
    if (!ctx || !this.bgmGain || this.bgmSource || !this.bgmBuffer) return
    const src = ctx.createBufferSource()
    src.buffer = this.bgmBuffer
    src.loop = true
    src.connect(this.bgmGain)
    src.start()
    this.bgmSource = src
  }

  private startSynthBgm(): void {
    const ctx = this.ctx
    if (!ctx || this.bgmTimer) return
    this.bgmStep = 0
    this.nextNoteAt = ctx.currentTime + 0.08
    this.bgmTimer = setInterval(() => this.scheduleBgm(), 25)
  }

  private stopSynthBgm(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
  }

  stopBgm(): void {
    this.stopSynthBgm()
    if (this.bgmSource) {
      try {
        this.bgmSource.stop()
      } catch {
        /* 已經停止 */
      }
      this.bgmSource = null
    }
  }

  private scheduleBgm(): void {
    const ctx = this.ctx
    if (!ctx || !this.bgmGain) return
    while (this.nextNoteAt < ctx.currentTime + 0.25) {
      const at = this.nextNoteAt - ctx.currentTime
      const step = this.bgmStep % TOTAL_STEPS
      const local = step % STEPS_PER_CHORD

      for (const note of bgmStep(step)) {
        this.tone(note.freq, note.len, {
          type: note.voice === 'bass' ? 'triangle' : 'square',
          gain: note.gain,
          at,
          destination: this.bgmGain,
        })
      }

      // 鼓組
      if (local === 0 || local === 8) {
        this.tone(70, 0.12, { type: 'sine', gain: 0.5, at, slideTo: 40, destination: this.bgmGain })
      }
      if (local === 4 || local === 12) {
        this.noiseHit(0.09, 0.16, at, 3000)
      }
      if (local % 2 === 0) {
        this.noiseHit(0.03, 0.05, at, 7000)
      }

      this.nextNoteAt += STEP_SEC
      this.bgmStep += 1
    }
  }
}

export const engine = new AudioEngine()

/** 播放音效（對外統一入口） */
export function playSfx(name: SfxName): void {
  engine.play(name)
}

/** 解鎖音訊（必須由使用者互動觸發） */
export function unlockAudio(): void {
  engine.unlock()
}

export function startBgm(): void {
  engine.startBgm()
}

export function stopBgm(): void {
  engine.stopBgm()
}
