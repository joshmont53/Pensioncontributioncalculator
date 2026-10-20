import { askGenerative } from '../server/src/generative.js';
import { handleAsk } from '../server/src/handleAsk.js';

// Vercel function: POST /api/generative (Implementation A). Same logic as the
// local Express server; ANTHROPIC_API_KEY comes from the Vercel project's
// environment variables.
export const config = { maxDuration: 60 };

export async function POST(request: Request) {
  const visitor = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const body = await request.json().catch(() => null);
  const { status, json } = await handleAsk('generative', askGenerative, body, visitor);
  return Response.json(json, { status });
}
