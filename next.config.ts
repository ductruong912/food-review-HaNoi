import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
