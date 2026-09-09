import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — there are unrelated package-lock.json
  // files further up this machine's directory tree (outside this project),
  // which would otherwise make Turbopack guess the wrong project root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
