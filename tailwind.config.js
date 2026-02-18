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
                    sidebar: '#1e1f1c',
                    accent: '#3e3d32',
                    fg: '#f8f8f2',
                    pink: '#f92672',
                    green: '#a6e22e',
                    yellow: '#e6db74',
                    orange: '#fd971f',
                    blue: '#66d9ef',
                    purple: '#ae81ff',
                    comment: '#75715e'
                }
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
                sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
