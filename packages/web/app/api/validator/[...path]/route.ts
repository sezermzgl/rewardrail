/**
 * The panels' way to the validator.
 *
 * This was a rewrite in next.config.ts, which was enough while the validator
 * was open. It is not any more: the write routes need an `x-rewardrail-key`
 * header, and a rewrite cannot add one. The secret must never reach the
 * browser — a guard whose key ships in the bundle is decoration — so the
 * request is made here, on the server, and the key is read from a variable
 * with no NEXT_PUBLIC_ prefix.
 *
 * It stays a proxy rather than an API of its own on purpose. The panels call
 * the same paths they always did, and the validator is still the only place
 * that knows what any of them mean.
 */
import { type NextRequest, NextResponse } from 'next/server';

const ORIGIN = process.env.VALIDATOR_ORIGIN ?? 'http://localhost:8787';
const WRITE_SECRET = process.env.VALIDATOR_WRITE_SECRET;

/** Never cached: every panel read is a claim about the chain right now. */
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string[]) {
  const target = new URL(`${ORIGIN}/${path.join('/')}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // The anchor's session token is the caller's to pass through; it is not ours
  // and it is not the write secret.
  const anchorToken = request.headers.get('x-anchor-token');
  if (anchorToken) headers.set('x-anchor-token', anchorToken);
  if (WRITE_SECRET) headers.set('x-rewardrail-key', WRITE_SECRET);

  const body = request.method === 'GET' ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body });
  } catch {
    // The shape the panels already understand: lib/demo/validator.ts turns a
    // failed reach into the "offline" state rather than an error, and the two
    // chain-backed panels keep working without it.
    return NextResponse.json(
      {
        error: 'The validator is not reachable.',
        detail: 'It is a separate service; the chain-backed panels do not need it.',
      },
      { status: 503 },
    );
  }

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}
