/**
 * commitlint 配置文件
 * @see https://commitlint.js.org/#/reference-rules
 * @see https://cz-git.qbb.sh/zh/guide/
 */

import { execSync } from 'node:child_process'

const allowedScopes = [
  'components',
  'utils',
  'hooks',
  'styles',
  'api',
  'types',
  'config',
  'build',
  'ci',
  'docs',
  'test',
  'deps',
  'other'
]

const scopeComplete = execSync('git status --porcelain || true')
  .toString()
  .trim()
  .split('\n')
  .find((r) => ~r.indexOf('M  src'))
  ?.replaceAll(/(\/)/g, '%%')
  ?.match(/src%%((\w|-)*)/)?.[1]
  ?.replace(/s$/, '')

/**
 * @type {import('cz-git').UserConfig}
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  plugins: ['commitlint-plugin-function-rules'],
  prompt: {
    alias: {
      b: 'build: bump deps',
      c: 'chore: update config',
      f: 'docs: fix typos',
      r: 'docs: update README',
      s: 'style: update code format'
    },

    allowCustomIssuePrefix: false,
    allowEmptyIssuePrefix: false,

    customScopesAlign: scopeComplete ? 'bottom' : 'top',
    defaultScope: scopeComplete,

    typesAppend: [
      { value: 'workflow', name: 'workflow: workflow improvements' },
      { value: 'types', name: 'types: type definition changes' },
      { value: 'wip', name: 'wip: work in progress' }
    ]
  },

  rules: {
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [1, 'always'],
    'header-max-length': [2, 'always', 108],
    'function-rules/scope-enum': [
      2,
      'always',
      (parsed) => {
        if (!parsed.scope || allowedScopes.includes(parsed.scope)) {
          return [true]
        }
        return [false, `scope must be one of: ${allowedScopes.join(', ')}`]
      }
    ],
    'scope-enum': [0],
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新增功能
        'fix', // 修复缺陷
        'docs', // 文档变更
        'style', // 代码格式
        'refactor', // 代码重构
        'perf', // 性能优化
        'test', // 测试相关
        'build', // 构建相关
        'ci', // CI 配置
        'chore', // 其他修改
        'revert', // 回滚
        'workflow', // 工作流
        'types', // 类型定义
        'wip' // 开发中
      ]
    ]
  }
}

export default config
