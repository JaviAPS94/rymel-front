import rymel from "@rymel/ui/preset";

/** @type {import('tailwindcss').Config} */
export default {
  // Colores, tipografía y sombras de marca vienen de @rymel/ui.
  presets: [rymel],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Las clases que usan los componentes del paquete.
    "./node_modules/@rymel/ui/dist/**/*.js",
  ],
  theme: {
    extend: {
      animation: {
        pulse: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      // Nombres antiguos que aún usa alguna pantalla, apuntando a los tokens.
      colors: {
        "primary-foreground": "#fcfcfc",
        accent: "#0086e3",
        background: "#F5F5F9",
        foreground: "#14132B",
        muted: "#6E6C86",
        "muted-foreground": "#5D5B76",
        input: "#E3E2EE",
      },
    },
  },
  plugins: [],
};
