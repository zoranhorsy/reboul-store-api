module.exports = {
    testEnvironment: 'node',
    setupFiles: ['dotenv/config'],
    testMatch: ['**/__tests__/**/*.test.js'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
    setupFilesAfterEnv: ['./__tests__/setup.js']
}; 