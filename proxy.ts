import { NextResponse, type NextRequest } from "next/server";

// Local "Live API" mode: forward /api/v1/* to the deployed backend so dev
// machines (read-only repo FS / empty local Postgres) can exercise the real
// API. Set API_PROXY_TARGET in .env.local to enable; unset on Vercel (the
// app's own routes serve /api/v1 there). See docs/api-requests.md W7.
export function proxy(request: NextRequest) {
  if (
    process.env.MOCK_API_ENABLED === '0' &&
    request.nextUrl.pathname.startsWith('/api/mock/')
  ) {
    return new NextResponse('Mock API disabled', { status: 404 }); // demo scaffolding: removable in production without touching FE code
  }
  const target = process.env.API_PROXY_TARGET;
  if (target && request.nextUrl.pathname.startsWith("/api/v1/")) {
    const destination = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      target,
    );
    return NextResponse.rewrite(destination);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*', '/api/mock/:path*'],
};
