module.exports = function (config) {
  config.set({
    testRunner: 'jest',
    testFramework: 'jest',
    mutator: { name: 'javascript', excludedMutations: ['StringLiteral'] },
    transpilers: [],
    reporter: ['clear-text', 'progress', 'html'],
    coverageAnalysis: 'off',
    mutate: ['src/**/*.js', '!src/**/*.test.js', '!src/**/*.testdata.js'],
    maxConcurrentTestRunners: 4
  })
}
