import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-pty などのネイティブモジュールをサーバーサイドで使うため
  serverExternalPackages: ["node-pty"],
};

export default nextConfig;
