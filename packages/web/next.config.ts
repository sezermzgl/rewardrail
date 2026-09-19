import type { NextConfig } from "next";

/**
 * The validator used to be reached through a rewrite declared here. It is a
 * route handler now — `app/api/validator/[...path]/route.ts` — because the
 * write routes require a secret header and a rewrite cannot add one without
 * putting the secret in the browser.
 *
 * What has not changed is why the panels go through this app at all: the
 * validator sends no CORS headers, so a browser refuses to call it
 * cross-origin, and same-origin also means the POSTs in #14-#16 never trigger
 * a preflight.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
