/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: {
          50:  '#f0fdf8',
          100: '#dcfcee',
          200: '#bbf7e0',
          300: '#A8E6CF',  // PRIMARY brand color
          400: '#6ecfaa',
          500: '#3bb889',
          600: '#28976e',
          700: '#1e7a5a',
          800: '#1b6149',
          900: '#18503d',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
