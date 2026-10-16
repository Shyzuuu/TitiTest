/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        brand: token('brand'),
        'brand-deep': token('brand-deep'),
        'brand-soft': token('brand-soft'),
        'brand-ink': token('brand-ink'),
        ok: token('ok'),
        danger: token('danger'),
        warn: token('warn'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 16 20 / 0.04), 0 4px 16px rgb(16 16 20 / 0.06)',
        lift: '0 2px 4px rgb(16 16 20 / 0.06), 0 12px 32px rgb(16 16 20 / 0.12)',
        glow: '0 8px 30px rgb(118 86 246 / 0.35)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        rise: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        fade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        sheet: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        check: { '0%': { strokeDashoffset: '48' }, '100%': { strokeDashoffset: '0' } },
        grow: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        rise: 'rise .28s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .2s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .2s ease-out both',
        sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1) both',
        shake: 'shake .42s ease-in-out',
        shimmer: 'shimmer 1.4s linear infinite',
        check: 'check .5s .1s ease-out both',
        grow: 'grow .7s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
