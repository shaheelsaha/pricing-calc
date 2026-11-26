// src/lib/rates/store.ts
// In-memory rate store (synced to localStorage). Replaces demo-rates as source of truth
// until Firebase is wired in.

import { Rate } from '@/types';
import { DEMO_RATES } from '@/lib/pricing/demo-rates';

const STORAGE_KEY = 'uae_freight_rates_v1';

function load(): Rate[] {
  if (typeof window === 'undefined') return DEMO_RATES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO_RATES;
    const parsed = JSON.parse(raw) as Rate[];
    return parsed.length ? parsed : DEMO_RATES;
  } catch {
    return DEMO_RATES;
  }
}

function save(rates: Rate[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rates)); } catch { /* noop */ }
}

// Singleton in-memory store
let _rates: Rate[] | null = null;

export function getRates(): Rate[] {
  if (!_rates) _rates = load();
  return _rates;
}

export function setRates(rates: Rate[]) {
  _rates = rates;
  save(rates);
}

export function addRate(rate: Rate) {
  const rates = getRates();
  _rates = [...rates, rate];
  save(_rates);
}

export function updateRate(rate: Rate) {
  const rates = getRates();
  _rates = rates.map(r => r.rateId === rate.rateId ? rate : r);
  save(_rates);
}

export function deleteRate(rateId: string) {
  const rates = getRates();
  _rates = rates.filter(r => r.rateId !== rateId);
  save(_rates);
}

export function resetToDefaults() {
  _rates = [...DEMO_RATES];
  save(_rates);
}

/* ─── Google Sheets sync config & helper ─────────────────────────────────── */
const SHEET_CONFIG_KEY = 'uae_freight_sheets_config_v1';

export interface SheetSyncConfig {
  url: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  lastCount?: number;
  lastTabCount?: number;
}

export function getSheetConfig(): SheetSyncConfig {
  const envUrl = process.env.NEXT_PUBLIC_RATES_SHEET_URL || '';
  if (typeof window === 'undefined') {
    return { url: envUrl, autoSync: true };
  }
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_KEY);
    if (!raw) return { url: envUrl, autoSync: true };
    const parsed = JSON.parse(raw) as Partial<SheetSyncConfig>;
    return {
      url: parsed.url ?? envUrl,
      autoSync: parsed.autoSync !== false,
      lastSyncedAt: parsed.lastSyncedAt,
      lastCount: parsed.lastCount,
      lastTabCount: parsed.lastTabCount,
    };
  } catch {
    return { url: envUrl, autoSync: true };
  }
}

export function setSheetConfig(config: SheetSyncConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHEET_CONFIG_KEY, JSON.stringify(config));
  } catch { /* noop */ }
}

export interface SheetSyncResult {
  ok: boolean;
  count?: number;
  tabCount?: number;
  skippedRows?: number;
  syncedAt?: string;
  error?: string;
}

export async function syncRatesFromGoogleSheet(url: string): Promise<SheetSyncResult> {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: 'Please enter a Google Sheet URL.' };

  try {
    const res = await fetch('/api/sheets-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    });
    const data = await res.json();

    if (!res.ok || !Array.isArray(data.rates)) {
      return { ok: false, error: data.error || 'Failed to sync Google Sheet.' };
    }

    setRates(data.rates as Rate[]);
    const prev = getSheetConfig();
    setSheetConfig({
      url: trimmed,
      autoSync: prev.autoSync,
      lastSyncedAt: data.syncedAt,
      lastCount: data.count,
      lastTabCount: data.tabCount,
    });

    return {
      ok: true,
      count: data.count,
      tabCount: data.tabCount,
      skippedRows: data.skippedRows,
      syncedAt: data.syncedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error while syncing Google Sheet.',
    };
  }
}
