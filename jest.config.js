export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: "es2022",
          moduleResolution: "node"
        }
      },
    ],
  },
  testPathIgnorePatterns: ["/node_modules/", "/functions/"],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx']
};
