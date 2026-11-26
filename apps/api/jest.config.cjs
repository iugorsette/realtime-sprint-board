module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: ['src/cards.service.ts', 'src/board.gateway.ts'],
  coverageThreshold: { global: { lines: 75 } },
};
