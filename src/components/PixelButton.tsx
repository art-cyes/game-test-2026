import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-gold text-night-900 hover:brightness-110',
  secondary: 'bg-night-600 text-ink hover:bg-night-500',
  danger: 'bg-hp text-white hover:brightness-110',
  success: 'bg-guard text-night-900 hover:brightness-110',
  ghost: 'bg-transparent text-muted hover:text-ink',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-4 py-2.5 text-xs',
  lg: 'px-6 py-3.5 text-sm',
  xl: 'px-8 py-5 text-base',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function PixelButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      className={[
        'font-pixel inline-flex items-center justify-center gap-2 rounded-none',
        'border-[3px] border-black select-none',
        'pixel-3d disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
