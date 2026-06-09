/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@drift/shared"],
  webpack: (config) => {
    // @drift/shared uses ESM ".js" specifiers in TS sources; map them back.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
