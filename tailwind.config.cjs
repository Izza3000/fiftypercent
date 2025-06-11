/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Custom scrollbar styles
      scrollbar: {
        DEFAULT: {
          size: '8px',
          track: 'transparent',
          thumb: '#CBD5E0',
          hover: '#A0AEC0',
        },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
} 