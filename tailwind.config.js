/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cortex: {
          bg: 'rgb(var(--cortex-bg) / <alpha-value>)',
          surface: 'rgb(var(--cortex-surface) / <alpha-value>)',
          border: 'rgb(var(--cortex-border) / <alpha-value>)',
          text: 'rgb(var(--cortex-text) / <alpha-value>)',
          muted: 'rgb(var(--cortex-muted) / <alpha-value>)',
          accent: 'rgb(var(--cortex-accent) / <alpha-value>)',
          success: 'rgb(var(--cortex-success) / <alpha-value>)',
          warning: 'rgb(var(--cortex-warning) / <alpha-value>)',
          danger: 'rgb(var(--cortex-danger) / <alpha-value>)',
          critical: 'rgb(var(--cortex-critical) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-ibm-plex)', 'IBM Plex Sans', 'sans-serif'],
        display: ['var(--font-inter-tight)', 'Inter Tight', 'sans-serif'],
        serif: ['Lora', 'Merriweather', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}