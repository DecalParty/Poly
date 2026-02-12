/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow native/Node-only modules to work server-side
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "sql.js", "ws"],
  },
};

module.exports = nextConfig;
