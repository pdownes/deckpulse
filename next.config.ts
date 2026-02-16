import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
