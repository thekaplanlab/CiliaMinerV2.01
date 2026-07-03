/**
 * tailwind.config.js
 *
 * Academic Database design system. All colors come from CSS variables
 * defined in src/app/globals.css, so a single `[data-theme="dark"]`
 * attribute on <html> flips the whole site between light and dark.
 *
 * Token names mirror the legacy primary-* / surface-* / accent-* scheme
 * so existing page markup doesn't need to change. Internally they now
 * resolve to a stone palette + red-800 accent.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Stone ink scale, keyed to legacy primary-* names so pages
        // don't need to be rewritten.
        primary: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          50:  'rgb(var(--paper)        / <alpha-value>)',
          100: 'rgb(var(--ink-line)     / <alpha-value>)',
          200: 'rgb(var(--ink-line-2)   / <alpha-value>)',
          300: 'rgb(var(--ink-muted-2)  / <alpha-value>)',
          400: 'rgb(var(--ink-muted)    / <alpha-value>)',
          500: 'rgb(var(--ink-soft)     / <alpha-value>)',
          600: 'rgb(var(--ink-mid)      / <alpha-value>)',
          700: 'rgb(var(--ink)          / <alpha-value>)',
          800: 'rgb(var(--ink-deep)     / <alpha-value>)',
          light: 'rgb(var(--ink-mid) / <alpha-value>)',
        },
        // Surfaces
        surface: 'rgb(var(--paper-raised) / <alpha-value>)',
        'surface-muted': 'rgb(var(--paper) / <alpha-value>)',
        'surface-white': 'rgb(var(--paper-white) / <alpha-value>)',

        // Accent — red-800 light / red-400 dark
        accent: 'rgb(var(--sage) / <alpha-value>)',
        'accent-dark': 'rgb(var(--sage-deep) / <alpha-value>)',
        'accent-soft': 'rgb(var(--sage-bg) / <alpha-value>)',
      },
      fontSize: {
        // Global type-scale bump — the base sizes ran a touch small site-wide,
        // so every named step is nudged up ~1px with a proportional line-height.
        // Explicit `leading-*` utilities still override the paired line-height
        // wherever a component sets one.
        xs:    ['0.8125rem', '1.125rem'],  // 13px / 18px  (was 12/16)
        sm:    ['0.9375rem', '1.375rem'],  // 15px / 22px  (was 14/20)
        base:  ['1.0625rem', '1.625rem'],  // 17px / 26px  (was 16/24)
        lg:    ['1.1875rem', '1.75rem'],   // 19px / 28px  (was 18/28)
        xl:    ['1.3125rem', '1.85rem'],   // 21px / 30px  (was 20/28)
        '2xl': ['1.5625rem', '2.1rem'],    // 25px / 34px  (was 24/32)
        '3xl': ['2rem',      '2.4rem'],    // 32px / 38px  (was 30/36)
        '4xl': ['2.375rem',  '2.7rem'],    // 38px / 43px  (was 36/40)
      },
      fontFamily: {
        // Plus Jakarta Sans for everything — including former "display"
        // headings. The old serif `font-display` references still work;
        // they just resolve to the sans face now.
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm:      '4px',
        md:      '8px',
        lg:      '10px',
      },
    },
  },
  plugins: [],
}
