/**
 * V3 Input — shared brand-aligned text/number/email input.
 *
 * Pattern:
 *   <Input
 *     label="Project size"
 *     hint="MW AC"
 *     value={mw}
 *     onChange={setMw}
 *     type="number"
 *     placeholder="5"
 *     error="Required"
 *   />
 *
 * Layout: optional eyebrow label (mono caps, ink-muted) + input with V3 chrome
 * (paper background option for institutional feel, teal focus ring) + optional
 * hint or error message below.
 *
 * Numeric inputs auto-apply font-mono so digits look like terminal readouts.
 */
import React from 'react'

export default function Input({
  label,
  hint,
  error,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  paper = false,
  required = false,
  disabled = false,
  id,
  name,
  ...rest
}) {
  const isNumeric = type === 'number'
  const inputId = id || name || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined)

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5"
        >
          {label}
          {required && <span className="ml-1 text-amber-600">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(isNumeric ? e.target.value : e.target.value, e)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`w-full text-sm rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 ${
          paper ? 'bg-paper' : 'bg-white'
        } ${
          isNumeric ? 'font-mono tabular-nums' : 'font-sans'
        } ${
          error
            ? 'border border-red-300 focus:border-red-500 focus:ring-red-500/15'
            : 'border border-gray-200'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'text-ink placeholder-gray-400'
        } ${inputClassName}`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-[11px] text-red-600 font-medium">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
