/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      maxWidth: {
        dashboard: '1440px',
      },
    },
  },
  plugins: [],
}
