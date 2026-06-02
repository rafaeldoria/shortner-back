/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.routes.ts",
    "!src/**/*.model.ts",
    "!src/**/*.types.ts",
    "!src/server.ts",
    "!src/app.ts",
    "!src/database/**",
  ],
  coverageDirectory: "coverage",
};
