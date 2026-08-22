/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],

  // Migrations run once before the suite; each file gets a clean slate.
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  setupFilesAfterEach: undefined,
  setupFiles: ['<rootDir>/tests/env.ts'],

  // Argon2 hashing is deliberately slow, so give the auth tests room.
  testTimeout: 60000,

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // tsconfig.json excludes tests/ (it is not part of the build), so
        // ts-jest gets the compiler options it needs inline.
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          types: ['jest', 'node'],
        },
        isolatedModules: true,
      },
    ],
  },

  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/middleware/**/*.ts',
    'src/utils/**/*.ts',
  ],

  // Prisma and ioredis hold handles briefly after disconnect.
  forceExit: true,
  detectOpenHandles: false,
  maxWorkers: 1,
};
