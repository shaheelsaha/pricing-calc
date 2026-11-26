'use client';
// src/components/rate-management/RateManagement.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { Rate, ChargeCategory, TransportMode, ContainerType, VehicleType } from '@/types';
import { UAE_LOCATIONS } from '@/constants/locations';
import {
  getRates,
  addRate,
  updateRate,
  deleteRate,
  resetToDefaults,
  getSheetConfig,
  setSheetConfig,
  syncRatesFromGoogleSheet,
} from '@/lib/rates/store';
import { downloadStructuredTemplate } from '@/lib/rates/sheets-sync';

/* ─── helpers ────────────────────────────────────────────────────────────── */
const CAT_LABELS: Record<ChargeCategory, string> = {
  terminal: 'Terminal',
  port: 'Port',
  customs: 'Customs',
  gate_pass: 'Gate Pass',
  trucking: 'Trucking',
  toll: 'Toll / Salik',
  delivery: 'Delivery',
  storage: 'Storage',
  documentation: 'Documentation',
  handling: 'Handling',
  other: 'Other',
};

const CAT_COLORS: Record<ChargeCategory, string> = {
  terminal: '#f59e0b',
  port: '#3b82f6',
  customs: '#8b5cf6',
  gate_pass: '#f97316',
  trucking: '#06b6d4',
  toll: '#a855f7',
  delivery: '#ef4444',
  storage: '#6b7280',
  documentation: '#10b981',
  handling: '#f59e0b',
  other: '#94a3b8',
};

function newBlankRate(): Partial<Rate> {
  return {
    chargeName: '',
    chargeCategory: 'terminal',
    mode: 'land',
    amount: 0,
    currency: 'AED',
    unit: 'per_container',
    active: true,
    validFrom: '2024-01-01',
    validUntil: '2030-12-31',
    source: 'Manual Entry',
    notes: '',
  };
}

const UNIT_LABELS: Record<string, string> = {
  per_shipment: 'Per Shipment',
  per_container: 'Per Container',
  per_vehicle: 'Per Vehicle',
  per_kg: 'Per KG',
  per_chargeable_kg: 'Per Chargeable KG',
  per_tonne: 'Per Tonne',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  fixed: 'Fixed',
};

/* ─── inline form ────────────────────────────────────────────────────────── */
interface RateFormProps {
  initial: Partial<Rate>;
  onSave: (r: Rate) => void;
  onCancel: () => void;
  existingIds: Set<string>;
}

function RateForm({ initial, onSave, onCancel, existingIds }: RateFormProps) {
  const [form, setForm] = useState<Partial<Rate>>(initial);
  const [err, setErr] = useState('');

  const set = (k: keyof Rate, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.chargeName?.trim()) { setErr('Charge name is required.'); return; }
    if (!form.amount || form.amount <= 0) { setErr('Amount must be greater than 0.'); return; }
    setErr('');

    const id = form.rateId ||
      `rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (!form.rateId && existingIds.has(id)) {
      setErr('Duplicate rate ID. Try again.'); return;
    }

    const now = new Date().toISOString().slice(0, 10);
    onSave({
      rateId: id,
      chargeName: form.chargeName!.trim(),
      chargeCategory: form.chargeCategory as ChargeCategory,
      mode: (form.mode || 'land') as TransportMode,
      originLocationId: form.originLocationId || undefined,
      destinationLocationId: form.destinationLocationId || undefined,
      amount: Number(form.amount),
      currency: form.currency || 'AED',
      unit: form.unit as Rate['unit'],
      containerType: form.containerType || undefined,
      vehicleType: form.vehicleType || undefined,
      validFrom: form.validFrom || '2024-01-01',
      validUntil: form.validUntil || '2030-12-31',
      active: form.active !== false,
      source: form.source || 'Manual Entry',
      notes: form.notes || '',
      createdAt: form.createdAt || now,
      updatedAt: now,
    });
  };

  const inp = (label: string, node: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      {node}
    </div>
  );

  const sel = (key: keyof Rate, options: { v: string; l: string }[], placeholder?: string) => (
    <select
      value={(form[key] as string) || ''}
      onChange={e => set(key, e.target.value || undefined)}
      style={INPUT_STYLE}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );

  const locations = UAE_LOCATIONS;

  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid #bfdbfe', borderRadius: 10,
      padding: '16px 20px', marginBottom: 12,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f', marginBottom: 14 }}>
        {form.rateId ? '✏️ Edit Rate' : '➕ New Rate'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px 16px' }}>
        {inp('Charge Name',
          <input
            value={form.chargeName || ''}
            onChange={e => set('chargeName', e.target.value)}
            placeholder="e.g. Gate Pass, THC"
            style={INPUT_STYLE}
          />
        )}
        {inp('Category',
          sel('chargeCategory',
            Object.entries(CAT_LABELS).map(([v, l]) => ({ v, l }))
          )
        )}
        {inp('Mode',
          sel('mode', [
            { v: 'land', l: '🚛 Land' },
            { v: 'sea', l: '🚢 Sea' },
            { v: 'air', l: '✈️ Air' },
          ])
        )}
        {inp('Amount (AED)',
          <input
            type="number" min={0} step={0.01}
            value={form.amount || ''}
            onChange={e => set('amount', parseFloat(e.target.value) || 0)}
            style={INPUT_STYLE}
          />
        )}
        {inp('Unit', sel('unit', Object.entries(UNIT_LABELS).map(([v, l]) => ({ v, l }))))}
        {inp('Origin Location',
          sel('originLocationId',
            [{ v: '', l: 'Any Origin' },
              ...locations.map(l => ({ v: l.locationId, l: `${l.name} (${l.emirate})` }))]
          )
        )}
        {inp('Destination Location',
          sel('destinationLocationId',
            [{ v: '', l: 'Any Destination' },
              ...locations.map(l => ({ v: l.locationId, l: `${l.name} (${l.emirate})` }))]
          )
        )}
        {inp('Container Type',
          sel('containerType', [
            { v: '', l: 'All' },
            { v: '20ft', l: '20ft' },
            { v: '40ft', l: '40ft' },
            { v: '40ft_hc', l: "40ft HC" },
            { v: 'reefer', l: 'Reefer' },
            { v: 'lcl', l: 'LCL' },
          ])
        )}
        {inp('Vehicle Type',
          sel('vehicleType', [
            { v: '', l: 'All' },
            { v: 'pickup', l: 'Pickup' },
            { v: '3ton', l: '3-Ton' },
            { v: '7ton', l: '7-Ton' },
            { v: '10ton', l: '10-Ton' },
            { v: '20ton', l: '20-Ton' },
            { v: 'trailer', l: 'Trailer / Semi-Truck' },
            { v: 'lowbed', l: 'Lowbed' },
          ])
        )}
        {inp('Valid From',
          <input type="date" value={form.validFrom || ''} onChange={e => set('validFrom', e.target.value)} style={INPUT_STYLE} />
        )}
        {inp('Valid Until',
          <input type="date" value={form.validUntil || ''} onChange={e => set('validUntil', e.target.value)} style={INPUT_STYLE} />
        )}
        {inp('Notes',
          <input value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" style={INPUT_STYLE} />
        )}
      </div>

      {err && <div style={{ marginTop: 10, color: '#dc2626', fontSize: 12 }}>⚠️ {err}</div>}

      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button onClick={handleSave} style={BTN_PRIMARY}>
          💾 Save Rate
        </button>
        <button onClick={onCancel} style={BTN_GHOST}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────────── */
export default function RateManagement() {
  const [rates, setRatesState] = useState<Rate[]>([]);
  const [editing, setEditing] = useState<Partial<Rate> | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sheetMsg, setSheetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setRatesState([...getRates()]), []);

  useEffect(() => {
    reload();
    const cfg = getSheetConfig();
    setSheetUrl(cfg.url);
    setAutoSync(cfg.autoSync);
    setLastSyncedAt(cfg.lastSyncedAt);
  }, [reload]);

  const handleSheetUrlChange = (val: string) => {
    setSheetUrl(val);
    const cfg = getSheetConfig();
    setSheetConfig({ ...cfg, url: val, autoSync });
  };

  const handleAutoSyncToggle = (checked: boolean) => {
    setAutoSync(checked);
    const cfg = getSheetConfig();
    setSheetConfig({ ...cfg, url: sheetUrl, autoSync: checked });
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSheetMsg(null);
    const res = await syncRatesFromGoogleSheet(sheetUrl);
    setSyncing(false);
    if (res.ok) {
      reload();
      setLastSyncedAt(res.syncedAt);
      setSheetMsg({
        ok: true,
        text: `Synced ${res.count} rates from ${res.tabCount} tab(s)${res.skippedRows ? ` (${res.skippedRows} empty/header rows skipped)` : ''}.`,
      });
    } else {
      setSheetMsg({ ok: false, text: res.error || 'Sync failed.' });
    }
  };

  const handleSave = (rate: Rate) => {
    if (editing?.rateId) {
      updateRate(rate);
    } else {
      addRate(rate);
    }
    setEditing(null);
    reload();
  };

  const handleDelete = (rateId: string) => {
    deleteRate(rateId);
    setConfirmDelete(null);
    reload();
  };

  const handleReset = () => {
    if (confirm('Reset all rates back to the sample demo data?')) {
      resetToDefaults();
      reload();
    }
  };

  /* Excel / CSV import */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('');

    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

      const now = new Date().toISOString().slice(0, 10);
      let imported = 0;
      const errors: string[] = [];

      rows.forEach((row, idx) => {
        try {
          const amount = parseFloat(String(row['amount'] ?? row['Amount'] ?? row['AMOUNT'] ?? 0));
          const name = String(row['chargeName'] ?? row['Charge Name'] ?? row['charge_name'] ?? '').trim();
          if (!name || !amount) return;

          const rate: Rate = {
            rateId: `import-${Date.now()}-${idx}`,
            chargeName: name,
            chargeCategory: (String(row['chargeCategory'] ?? row['Category'] ?? 'other').toLowerCase()) as ChargeCategory,
            mode: (String(row['mode'] ?? row['Mode'] ?? 'land').toLowerCase()) as TransportMode,
            originLocationId: String(row['originLocationId'] ?? row['Origin'] ?? '') || undefined,
            destinationLocationId: String(row['destinationLocationId'] ?? row['Destination'] ?? '') || undefined,
            amount,
            currency: String(row['currency'] ?? row['Currency'] ?? 'AED'),
            unit: (String(row['unit'] ?? row['Unit'] ?? 'per_container')) as Rate['unit'],
            containerType: (String(row['containerType'] ?? row['Container'] ?? '')) as ContainerType | undefined,
            vehicleType: (String(row['vehicleType'] ?? row['Vehicle'] ?? '')) as VehicleType | undefined,
            validFrom: String(row['validFrom'] ?? row['Valid From'] ?? '2024-01-01'),
            validUntil: String(row['validUntil'] ?? row['Valid Until'] ?? '2030-12-31'),
            active: true,
            source: `Import: ${file.name}`,
            notes: String(row['notes'] ?? row['Notes'] ?? ''),
            createdAt: now,
            updatedAt: now,
          };
          addRate(rate);
          imported++;
        } catch (err) {
          errors.push(`Row ${idx + 2}: ${err}`);
        }
      });

      reload();
      setImportMsg(`✅ Imported ${imported} rates${errors.length ? ` | ⚠️ ${errors.length} skipped` : ''}.`);
    } catch (err) {
      setImportMsg(`❌ Import failed: ${err}`);
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  /* filtered list */
  const filtered = rates.filter(r => {
    const q = search.toLowerCase();
    if (q && !r.chargeName.toLowerCase().includes(q) && !r.chargeCategory.includes(q)) return false;
    if (filterCat !== 'all' && r.chargeCategory !== filterCat) return false;
    if (filterMode !== 'all' && r.mode !== filterMode) return false;
    return true;
  });

  const existingIds = new Set(rates.map(r => r.rateId));
  const locationName = (id?: string) => id ? UAE_LOCATIONS.find(l => l.locationId === id)?.name ?? id : '—';

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc', padding: '24px 28px', minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>📊 Rate Management</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {rates.length} rates · Used live in New Quotation calculations
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button onClick={() => downloadStructuredTemplate(rates)} style={BTN_SECONDARY}>
            📄 Download Template
          </button>
          <button onClick={() => fileRef.current?.click()} style={BTN_SECONDARY}>
            📥 Import Excel
          </button>
          <button onClick={handleReset} style={BTN_GHOST}>
            🔄 Reset to Demo
          </button>
          <button
            onClick={() => setEditing(newBlankRate())}
            style={BTN_PRIMARY}
          >
            + Add Rate
          </button>
        </div>
      </div>

      {/* Google Sheets Live Sync Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #dbeafe',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 16,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📗</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Google Sheets Live Sync</span>
            {lastSyncedAt && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#15803d',
                background: '#dcfce7', padding: '2px 8px', borderRadius: 999,
              }}>
                Connected · Last synced {new Date(lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoSync}
              onChange={e => handleAutoSyncToggle(e.target.checked)}
            />
            Auto-sync on app startup
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="url"
            value={sheetUrl}
            onChange={e => handleSheetUrlChange(e.target.value)}
            placeholder="Paste your Google Sheet link once (Share → Anyone with the link can view)..."
            style={{ ...INPUT_STYLE, flex: 1, minWidth: 260 }}
          />
          <button
            onClick={handleSyncNow}
            disabled={syncing || !sheetUrl.trim()}
            style={{
              ...BTN_PRIMARY,
              opacity: syncing || !sheetUrl.trim() ? 0.6 : 1,
              cursor: syncing || !sheetUrl.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
          </button>
        </div>

        {sheetMsg && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 12,
            background: sheetMsg.ok ? '#f0fdf4' : '#fef2f2',
            color: sheetMsg.ok ? '#15803d' : '#dc2626',
            border: `1px solid ${sheetMsg.ok ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {sheetMsg.ok ? '✅ ' : '⚠️ '}
            {sheetMsg.text}
          </div>
        )}
      </div>

      {importMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: importMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color: importMsg.startsWith('✅') ? '#16a34a' : '#dc2626',
          fontSize: 13, border: `1px solid ${importMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {importMsg}
        </div>
      )}

      {/* Inline add/edit form */}
      {editing !== null && (
        <RateForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          existingIds={existingIds}
        />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search charges…"
          style={{ ...INPUT_STYLE, minWidth: 200, flex: 1, maxWidth: 300 }}
        />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All Categories</option>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All Modes</option>
          <option value="land">🚛 Land</option>
          <option value="sea">🚢 Sea</option>
          <option value="air">✈️ Air</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'white', borderRadius: 10, border: '1px solid #e2e8f0',
        overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              {['Category', 'Charge Name', 'Mode', 'Origin', 'Destination', 'Container / Vehicle', 'Amount', 'Unit', 'Valid Until', 'Status', 'Actions']
                .map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  {search || filterCat !== 'all' || filterMode !== 'all'
                    ? 'No rates match your search / filter.'
                    : 'No rates yet — click "Add Rate" to get started.'}
                </td>
              </tr>
            )}
            {filtered.map((rate, i) => (
              <tr
                key={rate.rateId}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: i % 2 === 0 ? 'white' : '#fafafa',
                  opacity: rate.active ? 1 : 0.5,
                }}
              >
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: CAT_COLORS[rate.chargeCategory] + '20',
                    color: CAT_COLORS[rate.chargeCategory],
                  }}>
                    {CAT_LABELS[rate.chargeCategory] ?? rate.chargeCategory}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b', maxWidth: 180 }}>{rate.chargeName}</td>
                <td style={{ padding: '8px 12px', color: '#475569' }}>
                  {rate.mode === 'land' ? '🚛' : rate.mode === 'sea' ? '🚢' : '✈️'} {rate.mode}
                </td>
                <td style={{ padding: '8px 12px', color: '#475569', fontSize: 12 }}>{locationName(rate.originLocationId)}</td>
                <td style={{ padding: '8px 12px', color: '#475569', fontSize: 12 }}>{locationName(rate.destinationLocationId)}</td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>
                  {rate.containerType || rate.vehicleType || <span style={{ color: '#94a3b8' }}>All</span>}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                  AED {rate.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{UNIT_LABELS[rate.unit] ?? rate.unit}</td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{rate.validUntil}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: rate.active ? '#dcfce7' : '#fee2e2',
                    color: rate.active ? '#16a34a' : '#dc2626',
                  }}>
                    {rate.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setEditing({ ...rate })}
                      title="Edit"
                      style={{ ...BTN_ICON, color: '#2563eb' }}
                    >✏️</button>
                    <button
                      onClick={() => { updateRate({ ...rate, active: !rate.active }); reload(); }}
                      title={rate.active ? 'Deactivate' : 'Activate'}
                      style={{ ...BTN_ICON, color: rate.active ? '#f59e0b' : '#16a34a' }}
                    >{rate.active ? '⏸' : '▶️'}</button>
                    {confirmDelete === rate.rateId ? (
                      <>
                        <button onClick={() => handleDelete(rate.rateId)} style={{ ...BTN_ICON, color: '#dc2626', fontWeight: 700 }}>✓</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ ...BTN_ICON, color: '#64748b' }}>✕</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(rate.rateId)}
                        title="Delete"
                        style={{ ...BTN_ICON, color: '#dc2626' }}
                      >🗑</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        Showing {filtered.length} of {rates.length} rates · Rates saved locally in browser and used immediately in New Quotation
      </div>

      {/* Excel template hint */}
      <div style={{
        marginTop: 16, padding: '10px 16px', borderRadius: 8,
        background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8',
      }}>
        📋 <strong>Excel Import Format:</strong> Columns →{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>chargeName</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>chargeCategory</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>mode</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>amount</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>unit</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>originLocationId</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>destinationLocationId</code>,{' '}
        <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>containerType</code>
      </div>
    </div>
  );
}

/* ─── shared styles ──────────────────────────────────────────────────────── */
const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
  background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 600,
  whiteSpace: 'nowrap',
};

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: '#10b981',
};

const BTN_GHOST: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: 'white', color: '#475569',
  border: '1.5px solid #e2e8f0',
};

const BTN_ICON: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 15, padding: '2px 4px', borderRadius: 4,
  lineHeight: 1,
};
