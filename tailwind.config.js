/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        accent: '#0A84FF',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
};
