import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      // Figma 导出的设计稿构建产物放在 public/design，这里补一个无尾斜杠的入口
      { source: "/design", destination: "/design/index.html" },
    ];
  },
};

export default nextConfig;
