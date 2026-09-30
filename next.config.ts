import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_LOCAL_SUPABASE_TEST === '1' ? { distDir: '.next-supabase-local' } : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "puvngplgugzskwgyytqa.supabase.co",
      },
      {
        protocol: "https",
        hostname: "xhkaendfzrnlmjfwdgut.supabase.co",
      },
      {
        protocol: "https",
        hostname: "qnbceaxbeipywcaocgjs.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
