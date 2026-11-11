import {
  isAudioEnabled,
  playSfx,
  setAudioEnabled,
  unlockAudio,
  useAudioEnabled,
} from '@/lib/audio'

export function SoundToggle() {
  const enabled = useAudioEnabled()

  const toggle = () => {
    const next = !isAudioEnabled()
    unlockAudio()
    setAudioEnabled(next)
    if (next) playSfx('click')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? '關閉音效' : '開啟音效'}
      title={enabled ? '關閉音效' : '開啟音效'}
      className={[
        'font-pixel fixed right-3 top-3 z-40 border-[3px] border-black px-2.5 py-1.5 text-sm',
        'pixel-3d',
        enabled ? 'bg-night-700 text-gold' : 'bg-night-800 text-muted',
      ].join(' ')}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  )
}
