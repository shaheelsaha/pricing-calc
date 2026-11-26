// src/lib/rates/sheets-sync.ts
// Google Sheets multi-tab workbook parser, location/category smart-mapper, and template generator.

import * as XLSX from 'xlsx';
import {
  Rate,
  ChargeCategory,
  TransportMode,
  ShipmentFlow,
  ContainerType,
  VehicleType,
  PricingBasis,
} from '@/types';
import { UAE_LOCATIONS } from '@/constants/locations';

const SKIP_TABS = new Set(['dropdowns', 'locations', 'locations guide', 'reference', 'instructions', 'readme']);

/** Extract Google Spreadsheet ID from any docs.google.com/spreadsheets URL or raw ID. */
export function extractGoogleSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Build the public XLSX export URL for a Google Sheet. */
export function buildGoogleSheetXlsxUrl(urlOrId: string): string | null {
  const id = extractGoogleSheetId(urlOrId);
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

/* ─── smart field mappers ────────────────────────────────────────────────── */
const LOCATION_ALIASES: Record<string, string> = {
  'jebel ali': 'jebel-ali-port',
  'jebel ali port': 'jebel-ali-port',
  'aejea': 'jebel-ali-port',
  'port rashid': 'port-rashid',
  'khalifa port': 'khalifa-port',
  'fujairah port': 'fujairah-port',
  'fujairah': 'fujairah-city',
  'sharjah port': 'sharjah-port',
  'khalid port': 'sharjah-port',
  'port khalid': 'sharjah-port',
  'dxb': 'dubai-airport',
  'dubai airport': 'dubai-airport',
  'dafza': 'dafza',
  'dafza (dubai airport free zone)': 'dafza',
  'dwc': 'al-maktoum-airport',
  'al maktoum': 'al-maktoum-airport',
  'dubai south': 'al-maktoum-airport',
  'auh': 'abu-dhabi-airport',
  'abu dhabi airport': 'abu-dhabi-airport',
  'shj airport': 'sharjah-airport',
  'sharjah airport': 'sharjah-airport',
  'saif zone': 'saif-zone',
  'sharjah saif zone': 'saif-zone',
  'hamriyah': 'hamriyah-free-zone',
  'hamriyah free zone': 'hamriyah-free-zone',
  'umm al quwain': 'umm-al-quwain',
  'uaq': 'umm-al-quwain',
  'al ain': 'al-ain',
  'khor khwair': 'khor-khwair-port',
  'khorkor port': 'khor-khwair-port',
  'jafza': 'jafza',
  'dic': 'dubai-industrial-city',
  'dubai industrial city': 'dubai-industrial-city',
  'al quoz': 'al-quoz',
  'dip': 'dubai-investment-park',
  'dubai investment park': 'dubai-investment-park',
  'sharjah industrial': 'sharjah-industrial',
  'sharjah': 'sharjah-city',
  'sharjah city': 'sharjah-city',
  'icad': 'abu-dhabi-industrial',
  'mussafah': 'abu-dhabi-industrial',
  'musafa': 'abu-dhabi-industrial',
  'ajman': 'ajman',
  'rak': 'ras-al-khaimah',
  'ras al khaimah': 'ras-al-khaimah',
  'abu dhabi': 'abu-dhabi-city',
  'abu dhabi city': 'abu-dhabi-city',
  'dubai': 'dubai-city',
  'dubai city': 'dubai-city',
};

export function resolveLocationId(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'all' || s === 'any' || s === '—' || s === '-') return undefined;

  const exactId = UAE_LOCATIONS.find(l => l.locationId.toLowerCase() === s);
  if (exactId) return exactId.locationId;

  const exactName = UAE_LOCATIONS.find(l => l.name.toLowerCase() === s);
  if (exactName) return exactName.locationId;

  if (LOCATION_ALIASES[s]) return LOCATION_ALIASES[s];

  const partial = UAE_LOCATIONS.find(
    l => l.name.toLowerCase().includes(s) || s.includes(l.name.toLowerCase()),
  );
  return partial?.locationId;
}

export function resolveCategory(raw: unknown, chargeName = ''): ChargeCategory {
  const s = String(raw ?? '').trim().toLowerCase();
  const combined = `${s} ${chargeName.toLowerCase()}`;

  if (s === 'terminal' || s.includes('thc')) return 'terminal';
  if (s === 'port' || s.includes('tluc')) return 'port';
  if (s === 'customs' || s.includes('boe') || s.includes('remat')) return 'customs';
  if (s === 'gate_pass' || s.includes('gate pass') || s.includes('gatepass')) return 'gate_pass';
  if (s === 'trucking' || s.includes('truck') || s.includes('transport')) return 'trucking';
  if (s === 'toll' || s.includes('salik') || s.includes('road toll')) return 'toll';
  if (s === 'delivery' || s.includes('unload')) return 'delivery';
  if (s === 'storage') return 'storage';
  if (s === 'documentation' || s.includes('doc') || s.includes('dpc') || s.includes('vsa')) return 'documentation';
  if (s === 'handling' || s.includes('protect') || s.includes('forklift') || s.includes('labour')) return 'handling';

  if (combined.includes('salik') || combined.includes('toll')) return 'toll';
  if (combined.includes('gate pass')) return 'gate_pass';
  if (combined.includes('thc') || combined.includes('terminal')) return 'terminal';
  if (combined.includes('boe') || combined.includes('customs') || combined.includes('remat')) return 'customs';
  if (combined.includes('truck')) return 'trucking';
  if (combined.includes('protect') || combined.includes('handling')) return 'handling';

  return 'other';
}

export function resolveMode(raw: unknown, tabName = ''): TransportMode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'sea' || s === 'ocean') return 'sea';
  if (s === 'air') return 'air';
  if (s === 'land' || s === 'road') return 'land';

  const t = tabName.toLowerCase();
  if (t.includes('sea') || t.includes('ocean') || t.includes('port')) return 'sea';
  if (t.includes('air')) return 'air';
  return 'land';
}

export function resolveShipmentFlow(raw: unknown, tabName = ''): ShipmentFlow {
  const s = String(raw ?? '').trim().toLowerCase();
  const t = `${s} ${tabName.toLowerCase()}`;

  if (s === 'all' || s === 'general') return 'all';
  if (s === 'import_row_local' || t.includes('from row') || (t.includes('import') && t.includes('row'))) {
    return 'import_row_local';
  }
  if (s === 'import_fz_local' || t.includes('from fz') || t.includes('import fz') || t.includes('from freezone')) {
    return 'import_fz_local';
  }
  if (s === 'fz_transit_in' || t.includes('transit in')) {
    return 'fz_transit_in';
  }
  if (s === 'fz_transit_out' || t.includes('transit out')) {
    return 'fz_transit_out';
  }
  if (s === 'export_local_row' || t.includes('export')) {
    return 'export_local_row';
  }
  return 'all';
}

export function resolveContainer(raw: unknown): ContainerType | undefined {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s || s === 'all' || s === 'any') return undefined;
  if (s === '20ft' || s === '20' || s.includes('20ft')) return '20ft';
  if (s === '40fthc' || s === '40ft_hc' || s === '40hc') return '40ft_hc';
  if (s === '40ft' || s === '40' || s.includes('40ft')) return '40ft';
  if (s.includes('reefer')) return 'reefer';
  if (s.includes('lcl') || s.includes('loose')) return 'lcl';
  if (s === 'other') return 'other';
  return undefined;
}

export function resolveVehicle(raw: unknown): VehicleType | undefined {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!s || s === 'all' || s === 'any') return undefined;
  if (s.includes('pickup')) return 'pickup';
  if (s.includes('3ton') || s === '3t') return '3ton';
  if (s.includes('7ton') || s === '7t') return '7ton';
  if (s.includes('10ton') || s === '10t') return '10ton';
  if (s.includes('20ton') || s === '20t') return '20ton';
  if (s.includes('lowbed')) return 'lowbed';
  if (s.includes('trailer') || s.includes('semi')) return 'trailer';
  return undefined;
}

export function resolveUnit(raw: unknown): PricingBasis {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const valid: PricingBasis[] = [
    'per_shipment', 'per_container', 'per_vehicle', 'per_kg',
    'per_chargeable_kg', 'per_tonne', 'per_trip', 'per_hour', 'per_day', 'fixed',
  ];
  if (valid.includes(s as PricingBasis)) return s as PricingBasis;
  if (s.includes('trip')) return 'per_trip';
  if (s.includes('container')) return 'per_container';
  if (s.includes('vehicle') || s.includes('truck') || s.includes('trailer')) return 'per_vehicle';
  if (s.includes('chargeable')) return 'per_chargeable_kg';
  if (s.includes('kg')) return 'per_kg';
  if (s.includes('tonne') || s.includes('ton')) return 'per_tonne';
  if (s.includes('shipment') || s.includes('boe') || s.includes('doc')) return 'per_shipment';
  if (s.includes('hour')) return 'per_hour';
  if (s.includes('day')) return 'per_day';
  if (s.includes('fixed')) return 'fixed';
  return 'per_container';
}

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.trim().toLowerCase(), v);
  }
  for (const k of keys) {
    const val = lowerMap.get(k.toLowerCase());
    if (val !== undefined && val !== '') return val;
  }
  return undefined;
}

const MATRIX_COLUMNS: { keys: string[]; vehicle?: VehicleType; container?: ContainerType; label: string }[] = [
  { keys: ['pickup'], vehicle: 'pickup', label: 'Pickup' },
  { keys: ['3 ton', '03 ton', '3ton'], vehicle: '3ton', label: '3 Ton' },
  { keys: ['7 ton', '07 ton', '7ton'], vehicle: '7ton', label: '7 Ton' },
  { keys: ['10 ton', '10ton'], vehicle: '10ton', label: '10 Ton' },
  { keys: ['20 ton', '20ton'], vehicle: '20ton', label: '20 Ton' },
  { keys: ['trailer', 'semi'], vehicle: 'trailer', label: 'Trailer' },
  { keys: ['lowbed', 'low bed'], vehicle: 'lowbed', label: 'Lowbed' },
  { keys: ['20 ft', '20ft', '20 ft container'], container: '20ft', label: '20 FT' },
  { keys: ['40 ft', '40ft', '40 ft container'], container: '40ft', label: '40 FT' },
];

/** Parse a multi-tab Excel/Google Sheet buffer into Rate[]. */
export function parseWorkbookToRates(
  buffer: ArrayBuffer,
  sourceLabel = 'Google Sheets',
): { rates: Rate[]; tabCount: number; skippedRows: number } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const now = new Date().toISOString().slice(0, 10);
  const rates: Rate[] = [];
  let tabCount = 0;
  let skippedRows = 0;

  for (const sheetName of wb.SheetNames) {
    if (SKIP_TABS.has(sheetName.trim().toLowerCase())) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!rows.length) continue;
    tabCount++;

    rows.forEach((row, idx) => {
      const originRaw = pickField(row, ['From', 'Origin', 'originLocationId', 'origin']);
      const destRaw = pickField(row, ['To', 'Destination', 'destinationLocationId', 'destination']);
      const originId = resolveLocationId(originRaw);
      const destId = resolveLocationId(destRaw);

      const rawActive = String(pickField(row, ['Active', 'active', 'Status']) ?? 'TRUE').trim().toLowerCase();
      const active = rawActive !== 'false' && rawActive !== '0' && rawActive !== 'no' && rawActive !== 'inactive';
      const notes = String(pickField(row, ['Notes', 'notes', 'Remarks', 'Remarks / Verification']) ?? '').trim();

      // Check if this row uses matrix columns (e.g. "03 Ton", "07 Ton", "10 Ton", "40 FT")
      let matchedMatrix = false;
      for (const col of MATRIX_COLUMNS) {
        const cellVal = pickField(row, col.keys);
        if (cellVal === undefined || cellVal === '') continue;
        const num = parseFloat(String(cellVal).replace(/,/g, ''));
        if (isNaN(num) || num <= 0) continue;

        matchedMatrix = true;
        const customName = String(
          pickField(row, ['Charge Name', 'chargeName', 'charge_name', 'Charge']) ?? '',
        ).trim();
        const routeLabel = originRaw && destRaw ? `Trucking (${originRaw} - ${destRaw})` : `Land Transport`;

        rates.push({
          rateId: `gs-${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx + 2}-${col.vehicle || col.container}`,
          chargeName: customName ? `${customName} (${col.label})` : `${routeLabel} (${col.label})`,
          chargeCategory: resolveCategory(
            pickField(row, ['Category', 'chargeCategory', 'charge_category']) ?? 'trucking',
            customName || routeLabel,
          ),
          mode: resolveMode(pickField(row, ['Mode', 'mode', 'Transport Mode']) ?? 'land', sheetName),
          shipmentFlow: resolveShipmentFlow(
            pickField(row, ['Shipment Type', 'shipmentFlow', 'Flow', 'Shipment Flow']) ?? 'all',
            sheetName,
          ),
          originLocationId: originId,
          destinationLocationId: destId,
          amount: num,
          currency: 'AED',
          unit: resolveUnit(pickField(row, ['Unit', 'unit', 'Basis']) ?? 'per_trip'),
          containerType: col.container,
          vehicleType: col.vehicle,
          validFrom: '2024-01-01',
          validUntil: '2030-12-31',
          active,
          source: `${sourceLabel} (${sheetName})`,
          notes,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (matchedMatrix) return;

      const chargeName = String(
        pickField(row, ['Charge Name', 'chargeName', 'charge_name', 'Charge', 'Name']) ?? '',
      ).trim();

      const rawAmount = pickField(row, ['Amount (AED)', 'Amount', 'amount', 'Rate', 'AED', 'Price']);
      const rawAmountStr = String(rawAmount ?? '').trim().toLowerCase();
      const isAtActual = rawAmountStr.includes('actual');
      const amount = isAtActual ? 0 : parseFloat(rawAmountStr.replace(/,/g, ''));

      if (!chargeName || (!isAtActual && (isNaN(amount) || amount <= 0))) {
        if (chargeName || rawAmount) skippedRows++;
        return;
      }

      const rate: Rate = {
        rateId: `gs-${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx + 2}`,
        chargeName,
        chargeCategory: resolveCategory(
          pickField(row, ['Category', 'chargeCategory', 'charge_category']),
          chargeName,
        ),
        mode: resolveMode(pickField(row, ['Mode', 'mode', 'Transport Mode']), sheetName),
        shipmentFlow: resolveShipmentFlow(
          pickField(row, ['Shipment Type', 'shipmentFlow', 'Flow', 'Shipment Flow']),
          sheetName,
        ),
        originLocationId: originId,
        destinationLocationId: destId,
        amount,
        isAtActual,
        currency: String(pickField(row, ['Currency', 'currency']) ?? 'AED').trim() || 'AED',
        unit: resolveUnit(pickField(row, ['Unit', 'unit', 'Basis', 'Rate / Basis'])),
        containerType: resolveContainer(
          pickField(row, ['Container', 'containerType', 'container_type', 'Container Type']),
        ),
        vehicleType: resolveVehicle(
          pickField(row, ['Vehicle', 'Truck', 'vehicleType', 'vehicle_type', 'Truck Type']),
        ),
        validFrom: String(pickField(row, ['Valid From', 'validFrom']) ?? '2024-01-01').trim() || '2024-01-01',
        validUntil: String(pickField(row, ['Valid Until', 'validUntil']) ?? '2030-12-31').trim() || '2030-12-31',
        active,
        source: `${sourceLabel} (${sheetName})`,
        notes,
        createdAt: now,
        updatedAt: now,
      };

      rates.push(rate);
    });
  }

  return { rates, tabCount, skippedRows };
}

/** Generate and download a structured .xlsx template ready to upload to Google Sheets. */
export function downloadStructuredTemplate(currentRates: Rate[]) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Charge Name',
    'Category',
    'Mode',
    'From',
    'To',
    'Container',
    'Vehicle',
    'Amount (AED)',
    'Unit',
    'Active',
    'Notes',
  ];

  const colWidths = [
    { wch: 28 }, { wch: 15 }, { wch: 10 }, { wch: 26 }, { wch: 26 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 9 }, { wch: 28 },
  ];

  const locName = (id?: string) =>
    id ? UAE_LOCATIONS.find(l => l.locationId === id)?.name ?? id : '';

  const toRow = (r: Rate) => [
    r.chargeName,
    r.chargeCategory,
    r.mode,
    locName(r.originLocationId),
    locName(r.destinationLocationId),
    r.containerType ?? '',
    r.vehicleType ?? '',
    r.isAtActual ? 'AT ACTUAL' : r.amount,
    r.unit,
    r.active ? 'TRUE' : 'FALSE',
    r.notes ?? '',
  ];

  const tabs: { name: string; flow: ShipmentFlow; sample: unknown[][] }[] = [
    {
      name: 'Import ROW to Local',
      flow: 'import_row_local',
      sample: [
        ['BOE - Duty Paid', 'customs', 'sea', 'Jebel Ali Port', '', '40ft', '', 95, 'per_shipment', 'TRUE', ''],
        ['Terminal Handling (40ft)', 'terminal', 'sea', 'Jebel Ali Port', '', '40ft', '', 1100, 'per_container', 'TRUE', ''],
      ],
    },
    {
      name: 'Import FZ to Local',
      flow: 'import_fz_local',
      sample: [
        ['Gate Pass', 'gate_pass', 'land', 'JAFZA (Jebel Ali Free Zone)', '', '', '', 55, 'per_vehicle', 'TRUE', ''],
        ['Salik Toll (Trailer)', 'toll', 'land', 'JAFZA (Jebel Ali Free Zone)', 'Sharjah City', '', 'trailer', 421, 'per_trip', 'TRUE', ''],
      ],
    },
    {
      name: 'FZ Transit IN',
      flow: 'fz_transit_in',
      sample: [
        ['BOE - Transit', 'customs', 'sea', 'Jebel Ali Port', 'JAFZA (Jebel Ali Free Zone)', '40ft', '', 105, 'per_shipment', 'TRUE', ''],
      ],
    },
    {
      name: 'FZ Transit OUT',
      flow: 'fz_transit_out',
      sample: [
        ['Customs Exit Submission', 'customs', 'sea', 'JAFZA (Jebel Ali Free Zone)', '', '40ft', '', 70, 'per_shipment', 'TRUE', ''],
      ],
    },
    {
      name: 'Export Local to ROW',
      flow: 'export_local_row',
      sample: [
        ['Gate Pass', 'gate_pass', 'sea', 'Jebel Ali Port', '', '', '', 55, 'per_vehicle', 'TRUE', ''],
        ['Terminal Handling (40ft)', 'terminal', 'sea', 'Jebel Ali Port', '', '40ft', '', 1100, 'per_container', 'TRUE', ''],
        ['VGM', 'documentation', 'sea', '', '', '40ft', '', 'AT ACTUAL', 'per_container', 'TRUE', 'At Actuals'],
        ['BL', 'documentation', 'sea', '', '', '40ft', '', 575, 'per_shipment', 'TRUE', ''],
      ],
    },
  ];

  for (const tab of tabs) {
    const matching = currentRates.filter(r => r.shipmentFlow === tab.flow);
    const rows = matching.length > 0 ? matching.map(toRow) : tab.sample;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, tab.name);
  }

  const guideRows = [
    ['Valid UAE Location Names (copy into From / To)', 'Location ID', 'Type', 'Emirate'],
    ...UAE_LOCATIONS.map(l => [l.name, l.locationId, l.locationType, l.emirate]),
    [],
    ['Valid Categories', 'Valid Modes', 'Valid Containers', 'Valid Vehicles', 'Valid Units'],
    ['terminal', 'land', '20ft', 'pickup', 'per_container'],
    ['port', 'sea', '40ft', '3ton', 'per_vehicle'],
    ['customs', 'air', '40ft_hc', '7ton', 'per_trip'],
    ['gate_pass', '', 'reefer', '10ton', 'per_shipment'],
    ['trucking', '', 'lcl', '20ton', 'per_kg'],
    ['toll', '', 'other', 'trailer', 'per_chargeable_kg'],
    ['delivery', '', '', 'lowbed', 'per_tonne'],
    ['documentation', '', '', '', 'fixed'],
    ['handling', '', '', '', 'per_hour'],
    ['storage', '', '', '', 'per_day'],
    ['other', '', '', '', ''],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 36 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Locations Guide');

  XLSX.writeFile(wb, 'VSA-UAE-Freight-Rates-Template.xlsx');
}
