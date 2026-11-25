/** @type {import('next').NextConfig} */
function getSupabaseHostname() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || raw.includes("your-project.supabase.co")) {
    return "*.supabase.co";
  }
  try {
    return new URL(raw).hostname;
  } catch {
    return "*.supabase.co";
  }
}

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: getSupabaseHostname(),
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
