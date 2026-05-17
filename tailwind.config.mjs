/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        'navy-deep': '#0F0F1B',
        'gold-mid': '#C6A554',
        'gold-light': '#D3B96B',
        'gold-accent': '#B47E2A',
        'cream-bg': '#FDFBF7',
        'brand-green': '#1B4332',
        'status-green': '#25D366',
        'surface-container': '#efeeea',
        'surface-container-high': '#eae8e4',
        'surface-container-highest': '#e4e2de',
        'on-surface-variant': '#504537',
        'primary-container': '#9d6a16',
      },
    },
  },
  plugins: [],
};
