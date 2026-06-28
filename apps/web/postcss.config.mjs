// Tailwind v4 wires into the build through its dedicated PostCSS plugin package
// (@tailwindcss/postcss) — there is no tailwind.config.js by default; configuration lives
// in CSS via `@import "tailwindcss"` + `@theme`. RESEARCH §Standard Stack.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
