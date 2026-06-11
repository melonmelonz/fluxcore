import { unzipSync } from 'fflate';
import type { PricePoint } from '../../src/core/types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_MS = 6 * HOUR_MS; // fixed UTC-6, DST ignored (matches engine)

export function latestDocId(docList: unknown): string {
  const docs = (docList as { ListDocsByRptTypeRes?: { DocumentList?: { Document?: { DocID?: unknown } }[] } })
    ?.ListDocsByRptTypeRes?.DocumentList;
  const id = docs?.[0]?.Document?.DocID;
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('malformed MIS doc list');
  return String(id);
}

export function unzipCsv(buf: Uint8Array): string {
  const files = unzipSync(buf);
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.csv'));
  if (!name) throw new Error('no csv in MIS zip');
  return new TextDecoder().decode(files[name]);
}

function rows(csv: string): string[][] {
  return csv.trim().split('\n').map((line) =>
    line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()),
  );
}

function centralEpoch(dateMMDDYYYY: string, hour0: number, minute: number): number {
  const [mm, dd, yyyy] = dateMMDDYYYY.split('/').map(Number);
  return Date.UTC(yyyy, mm - 1, dd, hour0, minute) + CENTRAL_OFFSET_MS;
}

export function parseRtmCsv(csv: string, hub: string): PricePoint[] {
  const [header, ...data] = rows(csv);
  const col = (n: string) => header.indexOf(n);
  const [iDate, iHour, iInt, iName, iPrice] = [
    col('DeliveryDate'), col('DeliveryHour'), col('DeliveryInterval'),
    col('SettlementPointName'), col('SettlementPointPrice'),
  ];
  return data
    .filter((r) => r[iName] === hub)
    .map((r) => ({
      t: centralEpoch(r[iDate], Number(r[iHour]) - 1, (Number(r[iInt]) - 1) * 15),
      price: Number(r[iPrice]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
    .sort((a, b) => a.t - b.t);
}

export function parseDamCsv(csv: string, hub: string): PricePoint[] {
  const [header, ...data] = rows(csv);
  const col = (n: string) => header.indexOf(n);
  const [iDate, iHE, iName, iPrice] = [
    col('DeliveryDate'), col('HourEnding'), col('SettlementPoint'), col('SettlementPointPrice'),
  ];
  return data
    .filter((r) => r[iName] === hub)
    .map((r) => ({
      t: centralEpoch(r[iDate], Number(r[iHE].split(':')[0]) - 1, 0),
      price: Number(r[iPrice]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
    .sort((a, b) => a.t - b.t);
}
