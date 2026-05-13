import React, { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './UIKit.module.css'

// ===== カテゴリセクション =====
export const CategorySection: React.FC<{
  title: string
  children: React.ReactNode
  headerBg: string
  bodyBg: string
}> = ({ title, children, headerBg, bodyBg }) => (
  <div className={styles.categorySection}>
    <div className={styles.categoryHeader} style={{ background: headerBg }}>{title}</div>
    <div className={styles.categoryBody} style={{ background: bodyBg }}>{children}</div>
  </div>
)

// ===== セクションタイトル =====
export const Section: React.FC<{
  title: string
  children: React.ReactNode
  titleColor?: string
}> = ({ title, children, titleColor }) => (
  <div className={styles.section}>
    <div className={styles.sectionTitle} style={titleColor ? { color: titleColor } : undefined}>{title}</div>
    {children}
  </div>
)

// ===== ラベル付き行 =====
export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <div className={styles.control}>{children}</div>
  </div>
)

// ===== ホバー表示ツールチップ（ネイティブ title よりスタイル可能）=====
export const HoverTooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  const updatePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxW = 280
    const margin = 8
    let left = r.left
    left = Math.max(margin, Math.min(left, window.innerWidth - maxW - margin))
    setPos({ top: r.bottom + 6, left })
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        className={styles.hoverTooltipTrigger}
        onMouseEnter={() => {
          updatePos()
          setOpen(true)
        }}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            role="tooltip"
            className={styles.hoverTooltipBubble}
            style={{ top: pos.top, left: pos.left, maxWidth: 280 }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

// ===== トグルスイッチ =====
export const Toggle: React.FC<{
  value: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
  theme?: 'default' | 'timerSync'
}> = ({ value, onChange, label, disabled = false, theme = 'default' }) => (
  <label className={styles.toggleWrapper}>
    <div
      className={`${styles.toggle} ${value ? styles.toggleOn : ''} ${theme === 'timerSync' ? styles.toggleTimerSync : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => { if (!disabled) onChange(!value) }}
    >
      <div className={styles.toggleThumb} />
    </div>
    {label && <span className={styles.toggleLabel}>{label}</span>}
  </label>
)

// ===== スライダー =====
export const Slider: React.FC<{
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  unit?: string
}> = ({ value, min, max, step = 1, onChange, unit }) => (
  <div className={styles.sliderWrapper}>
    <input
      type="range"
      className={styles.slider}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
    <span className={styles.sliderValue}>{value}{unit}</span>
  </div>
)

// ===== 数値入力 =====
export const NumberInput: React.FC<{
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  unit?: string
  disabled?: boolean
}> = ({ value, min, max, step = 1, onChange, unit, disabled = false }) => (
  <div className={styles.numberWrapper}>
    <input
      type="number"
      className={styles.numberInput}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
    />
    {unit && <span className={styles.unit}>{unit}</span>}
  </div>
)

export const TextInput: React.FC<{
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  onEnter?: () => void
}> = ({ value, onChange, placeholder, disabled, onEnter }) => (
  <input
    type="text"
    className={styles.textInput}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    onChange={e => onChange(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter') onEnter?.()
    }}
  />
)

// ===== カラーピッカー =====
export const ColorPicker: React.FC<{
  r: number; g: number; b: number
  onChange: (r: number, g: number, b: number) => void
  leading?: React.ReactNode
}> = ({ r, g, b, onChange, leading }) => {
  const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`

  const handleHexChange = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      onChange(parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16))
    }
  }

  return (
    <div className={styles.colorPickerWrapper}>
      <div className={styles.colorPickerRow}>
        {leading}
        <input
          type="color"
          className={styles.colorInput}
          value={hex}
          onChange={e => handleHexChange(e.target.value)}
        />
        <span className={styles.colorHex}>{hex.toUpperCase()}</span>
      </div>
    </div>
  )
}

// ===== ボタン =====
export const Button: React.FC<{
  onClick: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  small?: boolean
  disabled?: boolean
  title?: string
  className?: string
}> = ({ onClick, children, variant = 'secondary', small, disabled, title, className }) => (
  <button
    className={`${styles.button} ${styles[`button_${variant}`]} ${small ? styles.buttonSmall : ''} ${className ?? ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </button>
)

// ===== 繧｢繧､繧ｳ繝ｳ繝懊ち繝ｳ =====
export const IconButton: React.FC<{
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  title?: string
}> = ({ onClick, children, active, disabled, title }) => (
  <button
    type="button"
    className={`${styles.iconButton} ${active ? styles.iconButtonActive : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </button>
)

// ===== セレクト =====
export const Select: React.FC<{
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
}> = ({ value, options, onChange, disabled = false }) => (
  <select
    className={styles.select}
    value={value}
    disabled={disabled}
    onChange={e => onChange(e.target.value)}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
)

// ===== グリッドスピナー（±ボタン付き数値） =====
export const Stepper: React.FC<{
  value: number
  min: number
  max: number
  onDecrement: () => void
  onIncrement: () => void
  onDecrementAtMin?: () => void
  label?: string
}> = ({ value, min, max, onDecrement, onIncrement, onDecrementAtMin, label }) => {
  const atMin = value <= min
  const decrementDisabled = atMin && !onDecrementAtMin
  const handleDecrement = atMin && onDecrementAtMin ? onDecrementAtMin : onDecrement
  return (
    <div className={styles.stepper}>
      <button className={styles.stepBtn} onClick={handleDecrement} disabled={decrementDisabled}>−</button>
      <span className={styles.stepValue}>{value}{label}</span>
      <button className={styles.stepBtn} onClick={onIncrement} disabled={value >= max}>＋</button>
    </div>
  )
}
