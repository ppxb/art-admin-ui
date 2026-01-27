import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: {
    html: true,
    json: true
  },
  rules: {
    'regexp/no-unused-capturing-group': 'off'
  }
})
