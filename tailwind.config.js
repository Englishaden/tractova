/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // === V3 design tokens (added 2026-04-28) ===
        // Adopt incrementally per Tractova_V3_Plan.md Step 5b. Tailwind built-ins
        // teal-500 (#14B8A6), teal-700 (#0F766E), amber-500 (#F59E0B),
        // red-600 (#DC2626), emerald-600 (#059669), slate-200 (#E2E8F0)
        // already cover accent/caution/critical/success/border-subtle.
        brand: {
          DEFAULT: '#0F1A2E',
          50:  '#E8EAEE',
          100: '#C5C9D2',
          200: '#9CA3AE',
          300: '#6F7888',
          400: '#404C61',
          500: '#1F2D45',
          600: '#0F1A2E',
          700: '#0A132A',
          800: '#070D1E',
          900: '#040611',
        },
        ink: {
          DEFAULT: '#0A1828',
          muted: '#5A6B7A',
        },
        paper: '#FAFAF7',
        feasibility: {
          1: '#F0FDFA',
          2: '#99F6E4',
          3: '#2DD4BF',
          4: '#14B8A6',
          5: '#0F766E',
        },
        // === Legacy tokens (kept for backward compatibility during V3 rollout) ===
        primary: {
          DEFAULT: '#0F6E56',
          50:  '#E8F5F1',
          100: '#C5E6DB',
          200: '#9DD4C4',
          300: '#6ECDB0',
          400: '#34B08A',
          500: '#1A9070',
          600: '#0F6E56',
          700: '#0A5240',
          800: '#063629',
          900: '#031A14',
        },
        accent: {
          DEFAULT: '#BA7517',
          50:  '#FDF5E6',
          100: '#FAE4B3',
          200: '#F5CD77',
          300: '#F0B43C',
          400: '#E09A1C',
          500: '#BA7517',
          600: '#9A5E0F',
          700: '#7A4709',
          800: '#5A3104',
          900: '#3A1C01',
        },
        surface: '#F8F7F4',
        chrome:  '#F1F0ED',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: {
        dashboard: '1440px',
      },
    },
  },
  plugins: [],
}
