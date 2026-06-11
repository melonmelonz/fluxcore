interface Env {
  LIVE_DESK: DurableObjectNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const hub = new URL(request.url).searchParams.get('hub') ?? 'HB_NORTH';
  if (!/^HB_[A-Z]+$/.test(hub)) return new Response('bad hub', { status: 400 });
  const stub = env.LIVE_DESK.get(env.LIVE_DESK.idFromName(hub));
  const res = await stub.fetch('https://desk/state');
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
};
