/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2457B1", // Azul Bedin Máquinas
          light: "#66C24D", // Verde Bedin Máquinas (mantido para compatibilidade)
          dark: "#ED3136", // Vermelho Bedin Máquinas
        },
        secondary: {
          DEFAULT: "#FFFDFF", // Branco Bedin Máquinas
          light: "#FFFDFF", // Branco Bedin Máquinas
        },
        background: {
          dark: "#2457B1", // Azul Bedin Máquinas
          light: "#FFFDFF", // Branco Bedin Máquinas
        },
        accent: {
          blue: "#2457B1", // Azul Bedin Máquinas
          red: "#ED3136", // Vermelho Bedin Máquinas
          yellow: "#FFCC00", // Amarelo Bedin Máquinas
          green: "#66C24D", // Verde Bedin Máquinas (mantido)
          white: "#FFFDFF", // Branco Bedin Máquinas
          cream: "#FFF9E6", // Creme suave
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
