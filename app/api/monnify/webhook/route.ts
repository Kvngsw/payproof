/**
 * app/api/monnify/webhook/route.ts — Compatibility alias (no /v1).
 *
 * The Monnify dashboard registration points here. Canonical handler lives at
 * app/api/v1/monnify/webhook/route.ts — this file adds zero logic, it only
 * re-exports so both URLs serve the identical handler. Prefer the /v1 URL
 * for any new registration.
 */
export const dynamic = 'force-dynamic';

export { POST } from '@/app/api/v1/monnify/webhook/route';
