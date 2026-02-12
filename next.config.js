/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow native/Node-only modules to work server-side
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "sql.js",
      "ws",
      "@polymarket/clob-client",
      "@polymarket/order-utils",
      "@ethersproject/wallet",
      "@ethersproject/providers",
      "@ethersproject/contracts",
      "axios",
    ],
  },
};

module.exports = nextConfig;
