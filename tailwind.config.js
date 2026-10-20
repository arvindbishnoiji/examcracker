/** @type {import('tailwindcss').Config} */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Live, admin-controlled palette. Defaults live in globals.css and are
        // replaced at runtime by SiteConfigContext.
        brand: {
          50: withOpacity('--ec-brand-50'),
          100: withOpacity('--ec-brand-100'),
          200: withOpacity('--ec-brand-200'),
          300: withOpacity('--ec-brand-300'),
          400: withOpacity('--ec-brand-400'),
          500: withOpacity('--ec-brand-500'),
          600: withOpacity('--ec-brand-600'),
          700: withOpacity('--ec-brand-700'),
          800: withOpacity('--ec-brand-800'),
          900: withOpacity('--ec-brand-900'),
          DEFAULT: withOpacity('--ec-brand-600'),
        },
        ink: {
          50: withOpacity('--ec-ink-50'),
          100: withOpacity('--ec-ink-100'),
          200: withOpacity('--ec-ink-200'),
          300: withOpacity('--ec-ink-300'),
          400: withOpacity('--ec-ink-400'),
          500: withOpacity('--ec-ink-500'),
          600: withOpacity('--ec-ink-600'),
          700: withOpacity('--ec-ink-700'),
          800: withOpacity('--ec-ink-800'),
          900: withOpacity('--ec-ink-900'),
        },
        surface: 'var(--ec-surface)',
        canvas: 'var(--ec-bg)',
      },
      fontFamily: {
        sans: ['var(--ec-font-body)'],
        heading: ['var(--ec-font-heading)'],
      },
      borderRadius: {
        theme: 'var(--ec-radius)',
        'theme-sm': 'var(--ec-radius-sm)',
        'theme-lg': 'var(--ec-radius-lg)',
        button: 'var(--ec-button-radius)',
      },
      maxWidth: {
        shell: 'var(--ec-max-width)',
      },
      boxShadow: {
        card: 'var(--ec-card-shadow)',
      },
      gap: {
        section: 'var(--ec-section-gap)',
      },
    },
  },
  plugins: [],
};
