import type {NextConfig} from 'next'

const securityHeaders = [
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'Referrer-Policy', value: 'same-origin'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'},
  {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains'},
]

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.supabase.co')

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol === 'http:' ? 'http' : 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: '/storage/v1/object/public/resource-images/**',
      },
    ],
  },
  headers: async () => [{source: '/:path*', headers: securityHeaders}],
}

export default nextConfig
