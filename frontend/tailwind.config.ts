import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07132f",
        brand: "#1767f5"
      }
    }
  },
  plugins: []
} satisfies Config;
