const DISABLED = 0
const WARN = 1
const ERROR = 2

module.exports = {
    parser: '@typescript-eslint/parser',
    extends: [
        'streamr-nodejs',
        'plugin:promise/recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        'newline-per-chained-call': DISABLED,
        'max-len': [WARN, {
            code: 150
        }],
        'max-classes-per-file': DISABLED,
        'promise/always-return': WARN,
        'import/no-unresolved': DISABLED,
        'import/extensions': DISABLED,
        // TODO remove some of these is possible
        'import/order': DISABLED,
        'quotes': DISABLED,
        'quote-props': DISABLED,
        'object-curly-newline': DISABLED,
        'promise/no-callback-in-promise': DISABLED,
        '@typescript-eslint/no-unused-vars': [ERROR, { 'argsIgnorePattern': '^_' }],
        '@typescript-eslint/no-explicit-any': DISABLED,
        '@typescript-eslint/no-empty-function': DISABLED,
        '@typescript-eslint/no-non-null-assertion': DISABLED
    },
    'overrides': [
        {
            'files': ['*.js'],
            'rules': {
                '@typescript-eslint/no-var-requires': DISABLED
            }
        }
    ]
}
