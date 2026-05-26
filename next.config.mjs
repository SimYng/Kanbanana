/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 输出仅用于 Docker 构建（避免 Windows symlink 权限问题）
  output: process.env.NEXT_BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
};

export default nextConfig;
