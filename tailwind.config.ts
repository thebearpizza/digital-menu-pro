import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // gray/blue/white passano da variabili CSS: valori Tailwind standard ovunque,
      // palette avorio/oro dentro il gestionale (.lito-admin, vedi globals.css).
      colors: {
        white: 'rgb(var(--tw-white) / <alpha-value>)',
        gray: { 50: 'rgb(var(--tw-gray-50) / <alpha-value>)', 100: 'rgb(var(--tw-gray-100) / <alpha-value>)', 200: 'rgb(var(--tw-gray-200) / <alpha-value>)', 300: 'rgb(var(--tw-gray-300) / <alpha-value>)', 400: 'rgb(var(--tw-gray-400) / <alpha-value>)', 500: 'rgb(var(--tw-gray-500) / <alpha-value>)', 600: 'rgb(var(--tw-gray-600) / <alpha-value>)', 700: 'rgb(var(--tw-gray-700) / <alpha-value>)', 800: 'rgb(var(--tw-gray-800) / <alpha-value>)', 900: 'rgb(var(--tw-gray-900) / <alpha-value>)', 950: 'rgb(var(--tw-gray-950) / <alpha-value>)' },
        blue: { 50: 'rgb(var(--tw-blue-50) / <alpha-value>)', 100: 'rgb(var(--tw-blue-100) / <alpha-value>)', 200: 'rgb(var(--tw-blue-200) / <alpha-value>)', 300: 'rgb(var(--tw-blue-300) / <alpha-value>)', 400: 'rgb(var(--tw-blue-400) / <alpha-value>)', 500: 'rgb(var(--tw-blue-500) / <alpha-value>)', 600: 'rgb(var(--tw-blue-600) / <alpha-value>)', 700: 'rgb(var(--tw-blue-700) / <alpha-value>)', 800: 'rgb(var(--tw-blue-800) / <alpha-value>)', 900: 'rgb(var(--tw-blue-900) / <alpha-value>)', 950: 'rgb(var(--tw-blue-950) / <alpha-value>)' },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
