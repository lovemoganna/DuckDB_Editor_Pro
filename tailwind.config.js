/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./types.ts",
        "./App.tsx"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                monokai: {
                    bg: '#272822',
                    surface: '#1e1f1c',
                    sidebar: '#3e3d32',
                    border: '#49483e',
                    fg: '#f8f8f2',
                    'fg-muted': '#75715e',
                    pink: '#f92672',
                    green: '#a6e22e',
                    yellow: '#e6db74',
                    orange: '#fd971f',
                    blue: '#66d9ef',
                    purple: '#ae81ff',
                    comment: '#75715e',
                    accent: '#66d9ef',
                    'accent-hover': '#8be9fd',
                    // Semantic colors
                    primary: '#66d9ef',
                    success: '#a6e22e',
                    warning: '#e6db74',
                    danger: '#f92672',
                    info: '#66d9ef',
                }
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
                sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
            },
            backgroundColor: {
                'monokai-bg': '#272822',
                'monokai-surface': '#1e1f1c',
                'monokai-sidebar': '#3e3d32',
            },
        },
    },
    plugins: [],
}
