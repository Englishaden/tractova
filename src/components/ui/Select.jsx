/**
 * V3 Select — shared brand-aligned select component.
 *
 * Pattern:
 *   <Select
 *     label="Stage"
 *     value={stage}
 *     onChange={setStage}
 *     options={['Prospecting', 'Site Control', 'Pre-Development']}
 *     placeholder="Select stage..."
 *   />
 *
 * Options can be:
 *   - string[]: ['A', 'B']                                  → label === value
 *   - { value, label }[]: [{ value: 'a', label: 'Apple' }]
 *
 * V3 chrome: hairline border, paper or white bg, teal focus ring,
 * mono caps eyebrow label.
 */
import React from 'react'

export default function Select({
  label,
  hint,
  error,
  value,
  onChange,
  options = [],
  placeholder,
  className = '',
  selectClassName = '',
  paper = false,
  required = false,
  disabled = false,
  id,
  name,
  ...rest
}) {
  const selectId = id || name || (label ? `select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined)

  // Normalize options to { value, label } shape
  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5"
        >
          {label}
          {required && <span className="ml-1 text-amber-600">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value, e)}
        disabled={disabled}
        required={required}
        className={`w-full text-sm rounded-lg px-3 py-2 appearance-none transition-colors focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 ${
          paper ? 'bg-paper' : 'bg-white'
        } ${
          error
            ? 'border border-red-300 focus:border-red-500 focus:ring-red-500/15'
            : 'border border-gray-200'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'text-ink'
        } ${selectClassName}`}
        style={{
          // Custom chevron in teal -- matches the V3 accent
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230F766E' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '32px',
        }}
        {...rest}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {normalized.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-[11px] text-red-600 font-medium">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
