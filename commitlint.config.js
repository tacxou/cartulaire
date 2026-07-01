/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'daemon',
        'web',
        'core',
        'connector-contracts',
        'connector-sdk',
        'crypto',
        'config',
        'logger',
        'connectors',
        'deps',
        'docker',
        'ci',
        'root',
      ],
    ],
  },
}
