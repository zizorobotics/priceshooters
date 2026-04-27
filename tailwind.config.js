/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brandRed: '#d71f26',
        brandBlack: '#111111',
        softGray: '#f3f4f6'
      },
      boxShadow: {
        card: '0 8px 24px rgba(17, 17, 17, 0.08)'
      }
    }
  },
  plugins: []
};
