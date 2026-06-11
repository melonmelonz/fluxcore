import { describe, expect, it } from 'vitest';
import { fetchJsonWithChallenge, mergeCookieJar } from '../lib/challenge';

const json = (body: unknown, cookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(JSON.stringify(body), { headers });
};

const challenge = (cookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'text/html' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response('<html style="height:100%"><body>checking your browser</body></html>', { headers });
};

describe('mergeCookieJar', () => {
  it('strips attributes and keeps name=value pairs', () => {
    expect(mergeCookieJar(undefined, ['incap_ses_1=abc; path=/; HttpOnly'])).toBe('incap_ses_1=abc');
  });

  it('merges into an existing jar, newest value wins', () => {
    const jar = mergeCookieJar('a=1; b=2', ['b=3; path=/', 'c=4']);
    expect(jar).toBe('a=1; b=3; c=4');
  });

  it('returns the existing jar untouched when no cookies arrive', () => {
    expect(mergeCookieJar('a=1', [])).toBe('a=1');
    expect(mergeCookieJar(undefined, [])).toBeUndefined();
  });
});

describe('fetchJsonWithChallenge', () => {
  it('returns parsed JSON on a clean first response', async () => {
    const out = await fetchJsonWithChallenge('https://x/', async () => json({ ok: true }), undefined, 0);
    expect(out.json).toEqual({ ok: true });
  });

  it('replays challenge cookies and succeeds on retry', async () => {
    const seen: (string | null)[] = [];
    const fetchFn = async (_url: string, init?: RequestInit) => {
      const cookie = new Headers(init?.headers).get('cookie');
      seen.push(cookie);
      return seen.length === 1 ? challenge(['incap_ses_1=abc; path=/']) : json({ ok: 1 });
    };
    const out = await fetchJsonWithChallenge('https://x/', fetchFn, undefined, 0);
    expect(out.json).toEqual({ ok: 1 });
    expect(seen[1]).toContain('incap_ses_1=abc');
    expect(out.cookie).toContain('incap_ses_1=abc');
  });

  it('sends a provided cookie jar on the very first request', async () => {
    let first: string | null = null;
    const out = await fetchJsonWithChallenge(
      'https://x/',
      async (_url, init) => {
        first ??= new Headers(init?.headers).get('cookie');
        return json({ ok: 2 });
      },
      'visid_incap_1=zzz',
      0,
    );
    expect(first).toBe('visid_incap_1=zzz');
    expect(out.json).toEqual({ ok: 2 });
  });

  it('accumulates cookies across repeated challenges before succeeding', async () => {
    let n = 0;
    const fetchFn = async (_url: string, init?: RequestInit) => {
      n++;
      if (n === 1) return challenge(['visid_incap_1=v; path=/']);
      if (n === 2) return challenge(['incap_ses_1=s; path=/']);
      const cookie = new Headers(init?.headers).get('cookie') ?? '';
      expect(cookie).toContain('visid_incap_1=v');
      expect(cookie).toContain('incap_ses_1=s');
      return json({ ok: 3 });
    };
    const out = await fetchJsonWithChallenge('https://x/', fetchFn, undefined, 0);
    expect(out.json).toEqual({ ok: 3 });
  });

  it('throws after exhausting attempts on persistent challenges', async () => {
    await expect(
      fetchJsonWithChallenge('https://x/', async () => challenge(['a=1']), undefined, 0, 3),
    ).rejects.toThrow();
  });

  it('sends browser-like headers', async () => {
    let ua: string | null = null;
    await fetchJsonWithChallenge(
      'https://x/',
      async (_url, init) => {
        ua = new Headers(init?.headers).get('user-agent');
        return json({});
      },
      undefined,
      0,
    );
    expect(ua).toMatch(/Mozilla/);
  });
});
