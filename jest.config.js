module.exports = {
  verbose: true,
  collectCoverage: true,
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).js?(x)"],
  moduleFileExtensions: ["js", "json", "jsx", "node"],
  transform: {
    "^.+\\.(js|jsx)?$": "babel-jest",
  },
};
