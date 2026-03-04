/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy (keep for any remaining usage)
        primary: '#2D5040',
        accent: '#C94B2A',
        background: '#F7F5F0',
        dark: '#1A1A16',
        // New Botanical Luxury palette
        forest: {
          dark:    '#1A2E22',
          mid:     '#2D5040',
          light:   '#4A7A5E',
          subtle:  '#EAF0EC',
          DEFAULT: '#2D5040',
        },
        clay: {
          DEFAULT: '#C94B2A',
          light:   '#F0A07A',
        },
        gold: {
          DEFAULT: '#C4914A',
          light:   '#E8C68A',
        },
        cream: '#F7F5F0',
        surface: '#FFFFFF',
        'text-primary':   '#1A1A16',
        'text-secondary': '#6B6B60',
        'text-muted':     '#A8A89A',
        border: '#E5E0D5',
        // Keep brand for backward compat
        brand: {
          50:  '#f0f6f2',
          100: '#daeae0',
          200: '#b2d4c2',
          300: '#7fb9a0',
          400: '#529b7e',
          500: '#347f64',
          600: '#28654f',
          700: '#21503f',
          800: '#1a3d30',
          900: '#132c21',
        },
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', '"Outfit"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'serif'],
        mono:  ['"IBM Plex Mono"', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.05em',
        tighter:  '-0.04em',
        tight:    '-0.02em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card':       '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
        'elevated':   '0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.10)',
        'glow-forest': '0 0 24px rgba(42,80,64,0.25)',
      },
      transitionTimingFunction: {
        'magnetic': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spring':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':   'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-forest': 'linear-gradient(135deg, #1A2E22, #2D5040)',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
        'shimmer': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%':           { transform: 'scale(1)',   opacity: '1'   },
        },
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':      'shimmer 1.5s ease-in-out infinite',
        'float':        'float 3s ease-in-out infinite',
        'dot-bounce':   'dot-bounce 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
