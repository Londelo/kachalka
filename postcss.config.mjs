/** @type {import('postcss-load-config')} */
const config = {
  plugins: {
    tailwindcss: {
      config: './tailwind.config.js',
    },
    autoprefixer: {},
  },
}

export default config
