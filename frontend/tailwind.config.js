/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        profit: '#16a34a',
        loss: '#dc2626',
        primary: 'var(--mat-sys-primary, #3b82f6)',
        surface: {
          light: 'rgba(255, 255, 255, 0.65)',
          dark: 'rgba(17, 25, 40, 0.55)',
        },
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
      },
    },
  },
  corePlugins: {
    // Disabled to avoid Tailwind's reset stripping Angular Material's base component styles.
    preflight: false,
  },
  plugins: [],
};
