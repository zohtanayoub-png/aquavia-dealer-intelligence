import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep marine ink — the brand's water lineage without being literal.
        ink: {
          950: '#07161A',
          900: '#0B1F24',
          800: '#112E35',
          700: '#173C45',
          600: '#1F505B',
        },
        aqua: {
          50: '#EAFBF7',
          100: '#CDF5EC',
          200: '#9BEBD9',
          300: '#5FDBC2',
          400: '#2FC4A8',
          500: '#12A78C',
          600: '#0B8672',
          700: '#0C6B5D',
          800: '#0D554B',
          900: '#0D473F',
        },
        sand: {
          50: '#FAFAF8',
          100: '#F4F4F0',
          200: '#E8E8E2',
          300: '#D6D6CD',
          400: '#A8A89C',
        },
        priority: {
          a: '#0F9D6E',
          b: '#2A7FB8',
          c: '#B8862A',
          d: '#7A8085',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 31, 36, 0.04), 0 1px 3px rgba(11, 31, 36, 0.06)',
        lift: '0 2px 4px rgba(11, 31, 36, 0.05), 0 12px 28px -12px rgba(11, 31, 36, 0.25)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-500px 0' }, '100%': { backgroundPosition: '500px 0' } },
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
