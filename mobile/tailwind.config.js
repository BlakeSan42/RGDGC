/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary
        forest: {
          DEFAULT: "#1B5E20",
          light: "#4C8C4A",
          dark: "#003300",
        },
        disc: {
          DEFAULT: "#FF6B35",
          light: "#FF8A5B",
          dark: "#E55100",
        },
        // Score colors (UDisc-inspired)
        score: {
          eagle: "#7B1FA2",
          birdie: "#1B5E20",
          par: "#424242",
          bogey: "#E65100",
          double: "#B71C1C",
        },
        // Semantic
        accent: {
          gold: "#FFD700",
          blue: "#2196F3",
          purple: "#7B1FA2",
        },
      },
      fontFamily: {
        inter: ["Inter"],
        poppins: ["Poppins"],
        mono: ["JetBrainsMono"],
      },
    },
  },
  plugins: [],
};
