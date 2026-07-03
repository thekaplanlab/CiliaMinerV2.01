/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // "Ink" — deep, slightly blue-black. Reads nearly as a neutral
        // but retains scholarly gravity. Replaces the corporate navy.
        primary: {
          DEFAULT: '#1C2631',
          light: '#2C3B4A',
          dark: '#111820',
          50: '#F4F5F7',
          100: '#E4E7EC',
          200: '#C3C9D3',
          300: '#98A1AF',
          400: '#6B7687',
          500: '#47515F',
          600: '#1C2631',
          700: '#141C26',
          800: '#0C121A',
          900: '#060A0F',
        },
        // Oxblood — the single signal color. Used sparingly for emphasis,
        // active states, and critical links. Never fills large areas.
        accent: {
          DEFAULT: '#8B2635',
          light: '#A54050',
          dark: '#5F1821',
        },
        // Warm paper — "off-white" backgrounds that feel like
        // a lab notebook margin, not a SaaS dashboard.
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#FAF6EC',
          hover: '#F2ECDC',
        },
        // Ochre — a second, muted accent for data viz context
        // (gridlines on charts, subtle callouts). Not for UI chrome.
        ochre: {
          DEFAULT: '#C48A3A',
          light: '#E3B35E',
          dark: '#8A5E20',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['clamp(3rem, 5vw + 1rem, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '400' }],
        'title': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '400' }],
      },
      backgroundImage: {
        'paper-grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'cilium-sway': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        'stagger-in': 'stagger-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'cilium-sway': 'cilium-sway 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
