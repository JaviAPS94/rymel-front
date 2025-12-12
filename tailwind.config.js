/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "sans-serif"], // Set Montserrat as the default sans-serif font
      },
      animation: {
        pulse: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      colors: {
        "rymel-blue": "#1b1363",
        "rymel-yellow": "#d4c034",
        "primary-foreground": "#fcfcfc",
        accent: "#0086e3",
        background: "#f9f9f9",
        foreground: "#1a1a1a",
        muted: "#6b7280",
        "muted-foreground": "#60607a",
        input: "#e5e7eb",
      },
    },
  },
  plugins: [],
};
