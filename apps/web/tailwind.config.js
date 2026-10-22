/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        musgo: '#384543',
        whisper: '#F5F3EF',
        peridot: '#328161',
        sereno: '#8A9A93',
        fairway: '#21875A',
        pelota: '#E9E633',
        wimbledon: '#006B3F',
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Archivo"', 'system-ui', 'sans-serif'],
        body: ['"Archivo"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
