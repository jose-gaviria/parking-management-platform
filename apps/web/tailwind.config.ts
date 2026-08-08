import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño operacional:
 * - brand: acciones principales (azul profundo)
 * - success/warning/danger: estados operativos
 * - Tamaños táctiles grandes por defecto en botones (ver components/ui)
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e1ebff',
          200: '#c8d9ff',
          300: '#a2bdff',
          400: '#7597fa',
          500: '#5273f0',
          600: '#3d56dd',
          700: '#3243b8',
          800: '#2d3b94',
          900: '#293574',
          950: '#172044',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.03), 0 10px 30px rgba(15, 23, 42, 0.04)',
        lift: '0 16px 50px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
