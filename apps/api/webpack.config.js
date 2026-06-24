const nodeExternals = require("webpack-node-externals");

module.exports = (options) => ({
  ...options,
  // Bundle @drift/shared (workspace package) so webpack processes its TypeScript.
  // All other node_modules stay external (standard NestJS behavior).
  externals: [
    nodeExternals({
      allowlist: ["@drift/shared"],
    }),
  ],
  resolve: {
    ...options.resolve,
    // Resolve .js imports to .ts source in workspace packages (ESM TS pattern).
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
