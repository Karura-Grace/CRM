import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PAC brand palette — change here to re-skin the whole app.
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdaff",
          300: "#8ec2ff",
          400: "#599fff",
          500: "#337bfc",
          600: "#1d5cf1",
          700: "#1547dd",
          800: "#183ab3",
          900: "#1a368d",
          950: "#152256",
        },
      },
    },
  },
  plugins: [],
};
export default config;
