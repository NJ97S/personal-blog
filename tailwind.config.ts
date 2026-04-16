import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        craft: {
          50: '#fdf8f0',
          100: '#f5ead6',
          200: '#e8d5b0',
          300: '#d8ba84',
          400: '#c39d5c',
        },
        ink: {
          400: '#7a6a5a',
          600: '#4a3f35',
          800: '#2a2018',
          900: '#1a1410',
        },
      },
      fontFamily: {
        serif: ['var(--font-noto-serif-kr)', 'Noto Serif KR', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
