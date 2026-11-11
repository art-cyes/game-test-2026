import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  value: string
  size?: number
  className?: string
}

export function QRCodeCard({ value, size = 260, className = '' }: Props) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0718', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => {
        console.warn('[QRCode] 產生失敗', err)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <div
      className={`border-[3px] border-black bg-white p-2 pixel-frame ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          width={size}
          height={size}
          alt="加入 QR Code"
          className="pixelated block"
        />
      ) : (
        <div className="size-full animate-pulse-soft bg-night-700" />
      )}
    </div>
  )
}
