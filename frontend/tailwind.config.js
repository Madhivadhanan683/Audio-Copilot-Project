/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                daw: {
                    bg: '#121212',
                    panel: '#1e1e1e',
                    text: '#e0e0e0',
                    accent: '#bb86fc', // Purple generic accent
                    secondary: '#03dac6'
                }
            }
        },
    },
    plugins: [],
}
