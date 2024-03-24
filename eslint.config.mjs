import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  rules: {
    'no-console': 'warn',
  },
  formatters: {
    css: true,
  },
})
