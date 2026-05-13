/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: {
          50:  '#f3fcea',
          100: '#dcf5be',
          200: '#b5ea84',
          300: '#72c232',  // PRIMARY — matches ReBuilt Meals logo green
          400: '#5aaa24',
          500: '#47901b',
          600: '#377514',
          700: '#2b5c10',
          800: '#21470c',
          900: '#193808',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
