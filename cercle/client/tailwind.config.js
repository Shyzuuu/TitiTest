/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        panel: token('panel'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        mine: token('mine'),
        'mine-ink': token('mine-ink'),
        theirs: token('theirs'),
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        flash: { '0%': { backgroundColor: 'rgb(var(--accent) / 0.22)' }, '100%': { backgroundColor: 'transparent' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        blink: { '0%, 80%, 100%': { opacity: '.25' }, '40%': { opacity: '1' } },
      },
      animation: {
        flash: 'flash 1.6s ease-out',
        pop: 'pop .18s ease-out',
        rise: 'rise .2s ease-out',
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};
