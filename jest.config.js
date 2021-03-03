// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html
module.exports = {

    // Preset ts-jest
    preset: 'ts-jest',

    // Automatically clear mock calls and instances between every test
    clearMocks: true,

    // An array of glob patterns indicating a set of files for which coverage information should be collected
    collectCoverageFrom: ['src/**'],

    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',

    // The test environment that will be used for testing
    testEnvironment: 'node',

    // Default timeout of a test in milliseconds
    testTimeout: 10000,

    // This option allows use of a custom test runner
    testRunner: 'jest-circus/runner'
}
