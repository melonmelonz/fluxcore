import type { PricePoint } from '../../../src/core/types';

interface Env {
  FLUX_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const hub = new URL(request.url).searchParams.get('hub') ?? 'HB_NORTH';
  if (!/^HB_[A-Z]+$/.test(hub)) return new Response('bad hub', { status: 400 });
  const [rtm, dam] = await Promise.all([
    env.FLUX_KV.getWithMetadata<PricePoint[], { lastUpdated: number }>(`prices:${hub}:rtm`, 'json'),
    env.FLUX_KV.get<PricePoint[]>(`prices:${hub}:dam`, 'json'),
  ]);
  return Response.json(
    {
      hub,
      rtm: rtm.value ?? [],
      dam: dam ?? [],
      lastUpdated: rtm.metadata?.lastUpdated ?? null,
    },
    { headers: { 'cache-control': 'public, max-age=60' } },
  );
};
