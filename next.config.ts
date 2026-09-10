import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — there are unrelated package-lock.json
  // files further up this machine's directory tree (outside this project),
  // which would otherwise make Turbopack guess the wrong project root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Next's own dev-mode build-activity badge floats fixed at the bottom-left
  // of every page — exactly where the Sidebar's own footer card and
  // disclaimer text live, so in local `next dev` it visibly sits on top of
  // that disclaimer and looks like a real overlap/collision bug. It never
  // renders in a production build (next build/start, i.e. the live Vercel
  // site), but disabling it locally too avoids the false alarm.
  devIndicators: false,
};

export default nextConfig;
