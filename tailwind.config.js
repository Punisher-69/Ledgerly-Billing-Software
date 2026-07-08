/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          muted: '#fef9c3',
        },
        accent: {
          DEFAULT: '#facc15',
          hover: '#fde047',
        },
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
  plugins: [],
}
