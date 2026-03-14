import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "pp-navy": "#323B6A",
        "pp-green": "#BDCF7C",
        "pp-white": "#FFFFFF",
        "pp-light-blue": "#A7B8D1",
        "pp-light-green": "#DBEAA0",
        "pp-mid-blue": "#6F92BF",
        "pp-yellow": "#FEEA99",
        "pp-pale": "#E7EDF3",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        "alte-haas": ["AlteHaasGrotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
