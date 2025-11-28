/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,vue}',
    './public/index.html',
  ],
  darkMode: 'class', // use 'class' strategy for dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#FF6B35',
          dark: '#FF844D',
        },
        secondary: {
          light: '#FFD93D',
          dark: '#FFEB70',
        },
        accent: {
          light: '#06B67A',
          dark: '#1AD69F',
        },
        danger: {
          light: '#FF3B30',
          dark: '#FF5A4D',
        },
        warning: {
          light: '#FFB300',
          dark: '#FFD54F',
        },
        surface: {
          light: '#F5F5F5',
          dark: '#1E1E1E',
        },
        'surface-variant': {
          light: '#E0E0E0',
          dark: '#2A2A2A',
        },
        'text-primary': {
          light: '#0B0B0B',
          dark: '#F5F5F5',
        },
        'text-secondary': {
          light: '#4A4A4A',
          dark: '#CFCFCF',
        },
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
