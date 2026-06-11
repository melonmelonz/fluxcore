import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScenario } from '../scenario';

const DIR = resolve(process.cwd(), 'public/data');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');

describe('bundled scenario data', () => {
  it('has three scenarios and an index', () => {
    expect(files).toHaveLength(3);
    const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
    expect(index).toHaveLength(3);
  });

  for (const f of files) {
    it(`${f} parses and is sorted with sane sizes`, () => {
      const s = parseScenario(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
      expect(s.rtm.length).toBeGreaterThanOrEqual(600);
      expect(s.dam.length).toBeGreaterThanOrEqual(160);
      for (let i = 1; i < s.rtm.length; i++) expect(s.rtm[i].t).toBeGreaterThan(s.rtm[i - 1].t);
    });
  }
});
