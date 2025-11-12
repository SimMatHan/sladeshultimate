/** @type {import('tailwindcss').Config} */
const withOpacity = (cssVar) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(${cssVar}) / 1)`
    : `rgb(var(${cssVar}) / ${opacityValue})`;

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantiske farver koblet til tokens
        brand: withOpacity('--brand-rgb'),
        accent: withOpacity('--accent-rgb'),
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        subtle: 'var(--subtle)',
        line: 'var(--line)',
        success: withOpacity('--success-rgb'),
        warning: withOpacity('--warning-rgb'),
        danger: withOpacity('--danger-rgb'),
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'var(--radius-sm)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
    },
  },
  plugins: [],
};
