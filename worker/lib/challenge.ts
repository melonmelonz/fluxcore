/** ERCOT's MIS endpoints sit behind Imperva, which serves an HTML cookie
 *  challenge instead of JSON until the issued cookies are replayed. This
 *  helper retries with an accumulating cookie jar and browser-like headers. */

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
};

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Fold `set-cookie` headers into a `name=value; name=value` jar string. */
export function mergeCookieJar(jar: string | undefined, setCookies: string[]): string | undefined {
  if (setCookies.length === 0) return jar;
  const map = new Map<string, string>();
  for (const pair of jar?.split('; ') ?? []) {
    const eq = pair.indexOf('=');
    if (eq > 0) map.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  for (const c of setCookies) {
    const pair = c.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  return [...map].map(([k, v]) => `${k}=${v}`).join('; ');
}

export async function fetchJsonWithChallenge(
  url: string,
  fetchFn: FetchFn,
  cookie?: string,
  delayMs = 400,
  attempts = 4,
): Promise<{ json: unknown; cookie?: string }> {
  let jar = cookie;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const res = await fetchFn(url, {
      headers: jar ? { ...BROWSER_HEADERS, cookie: jar } : BROWSER_HEADERS,
    });
    jar = mergeCookieJar(jar, res.headers.getSetCookie?.() ?? []);
    const body = await res.text();
    try {
      return { json: JSON.parse(body), cookie: jar };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('challenge not cleared');
}
