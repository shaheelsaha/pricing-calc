// src/app/page.tsx
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar, { NavItem } from '@/components/layout/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import QuotationPanel from '@/components/pricing/QuotationPanel';
import RateManagement from '@/components/rate-management/RateManagement';
import {
  TransportMode, ShipmentFlow, ContainerType, VehicleType,
  Location, MapMarker, QuotationItem, RouteInfo,
} from '@/types';
import { UAE_LOCATIONS, JEBEL_ALI_CHECKPOINTS } from '@/constants/locations';
import { getRoute } from '@/lib/mapbox/directions';
import { calculatePricing, applyMarkup } from '@/lib/pricing/engine';
import { getRates, getSheetConfig, syncRatesFromGoogleSheet } from '@/lib/rates/store';

const FreightMap = dynamic(() => import('@/components/map/FreightMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1, backgroundColor: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: 13,
    }}>Loading UAE satellite map…</div>
  ),
});

/* ─── Placeholder pages ──────────────────────────────────────────────────── */
function PlaceholderPage({ title, icon, description, phase }: {
  title: string; icon: string; description: string; phase: string;
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, backgroundColor: '#f8fafc', padding: 40,
    }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{title}</div>
      <div style={{ fontSize: 14, color: '#64748b', maxWidth: 400, textAlign: 'center' }}>{description}</div>
      <div style={{
        marginTop: 8, padding: '8px 20px',
        backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 8, fontSize: 12, color: '#2563eb', fontWeight: 500,
      }}>Coming in {phase} ›</div>
    </div>
  );
}

/* ─── km distance along route (simple great-circle accumulation) ─────────── */
function kmsAlongRoute(
  coords: number[][],
  targetLng: number,
  targetLat: number,
): number {
  if (!coords || coords.length < 2) return 0;
  let best = Infinity;
  let bestKm = 0;
  let accum = 0;

  for (let i = 1; i < coords.length; i++) {
    const c0 = coords[i - 1], c1 = coords[i];
    if (!c0 || !c1 || c0.length < 2 || c1.length < 2) continue;
    const [x0, y0] = c0, [x1, y1] = c1;
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) continue;

    const segKm = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 111.32;
    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((targetLng - x0) * dx + (targetLat - y0) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx, py = y0 + t * dy;
    const dist = Math.sqrt((targetLng - px) ** 2 + (targetLat - py) ** 2);

    if (dist < best) {
      best = dist;
      bestKm = accum + t * segKm;
    }
    accum += segKm;
  }
  return isFinite(bestKm) ? bestKm : 0;
}

/* ─── New Quotation view ─────────────────────────────────────────────────── */
function NewQuotationView() {
  const [mode, setMode]                       = useState<TransportMode>('land');
  const [shipmentFlow, setShipmentFlow]       = useState<ShipmentFlow>('all');
  const [originId, setOriginId]               = useState('jebel-ali-port');
  const [destinationId, setDestinationId]     = useState('sharjah-city');
  const [containerType, setContainerType]     = useState<ContainerType>('40ft');
  const [vehicleType, setVehicleType]         = useState<VehicleType>('trailer');
  const [isCalculating, setIsCalculating]     = useState(false);
  const [hasCalculated, setHasCalculated]     = useState(false);
  const [route, setRoute]                     = useState<RouteInfo | null>(null);
  const [markers, setMarkers]                 = useState<MapMarker[]>([]);
  const [allItems, setAllItems]               = useState<QuotationItem[]>([]);
  // Items revealed so far during animation
  const [revealedItems, setRevealedItems]     = useState<QuotationItem[]>([]);
  const [externalFreight, setExternalFreight] = useState(0);
  const [externalCarrier, setExternalCarrier] = useState('');
  const [markup, setMarkup]                   = useState(10);
  const [markupType, setMarkupType]           = useState<'percentage' | 'fixed'>('percentage');
  const [sellingPrice, setSellingPrice]       = useState(0);
  const [margin, setMargin]                   = useState(0);
  const [warnings, setWarnings]               = useState<string[]>([]);
  const [highlightedId, setHighlightedId]     = useState<string | null>(null);
  const [isAnimating, setIsAnimating]         = useState(false);
  const [animComplete, setAnimComplete]       = useState(false);
  const [disabledIds, setDisabledIds]         = useState<Set<string>>(new Set());
  const [amountOverrides, setAmountOverrides] = useState<Record<string, number>>({});

  // Map marker → its items (for panel reveal sync)
  const markerItemsRef = useRef<Map<string, QuotationItem[]>>(new Map());

  const locations: Location[] = useMemo(() => UAE_LOCATIONS.map(l => ({
    ...l, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
  })), []);

  const originLocation      = locations.find(l => l.locationId === originId)      || null;
  const destinationLocation = locations.find(l => l.locationId === destinationId) || null;

  /* ─ build markers with route positions ─ */
  const buildMarkers = useCallback((
    items: QuotationItem[],
    origin: Location,
    destination: Location,
    routeCoords: number[][],
    totalKm: number,
  ): MapMarker[] => {
    const map = new Map<string, MapMarker>();
    const markerItems = new Map<string, QuotationItem[]>();

    // Charge items at origin (trucking & delivery go to destination pin)
    const originItems = items.filter(
      i => (i.locationId === origin.locationId || !i.locationId) &&
           i.chargeCategory !== 'delivery' &&
           i.chargeCategory !== 'trucking' &&
           i.chargeCategory !== 'toll'
    );

    if (origin.locationId === 'jebel-ali-port') {
      const terminalItems = originItems.filter(i =>
        i.chargeCategory === 'terminal' || i.chargeCategory === 'handling'
      );
      const doItems = originItems.filter(i =>
        i.chargeCategory === 'customs' || i.chargeCategory === 'documentation' ||
        (i.chargeCategory === 'port' && i.chargeName.toLowerCase().includes('do'))
      );
      const tokenItems = originItems.filter(i =>
        i.chargeCategory === 'port' && !i.chargeName.toLowerCase().includes('do')
      );
      const gateItems = originItems.filter(i =>
        i.chargeCategory === 'gate_pass' || i.chargeCategory === 'trucking' || i.chargeCategory === 'storage' || i.chargeCategory === 'other'
      );

      map.set('origin', {
        id: 'origin',
        locationId: origin.locationId,
        locationName: JEBEL_ALI_CHECKPOINTS.terminal.name,
        longitude: JEBEL_ALI_CHECKPOINTS.terminal.longitude,
        latitude: JEBEL_ALI_CHECKPOINTS.terminal.latitude,
        color: 'orange',
        chargeItems: terminalItems,
        isOrigin: true,
        routeDistanceKm: 0,
      });
      markerItems.set('origin', terminalItems);

      if (doItems.length > 0) {
        map.set(JEBEL_ALI_CHECKPOINTS.doOffice.id, {
          id: JEBEL_ALI_CHECKPOINTS.doOffice.id,
          locationId: origin.locationId,
          locationName: JEBEL_ALI_CHECKPOINTS.doOffice.name,
          longitude: JEBEL_ALI_CHECKPOINTS.doOffice.longitude,
          latitude: JEBEL_ALI_CHECKPOINTS.doOffice.latitude,
          color: 'blue',
          chargeItems: doItems,
          routeDistanceKm: Math.min(0.3, totalKm * 0.03),
        });
        markerItems.set(JEBEL_ALI_CHECKPOINTS.doOffice.id, doItems);
      }

      if (tokenItems.length > 0) {
        map.set(JEBEL_ALI_CHECKPOINTS.tokenGate.id, {
          id: JEBEL_ALI_CHECKPOINTS.tokenGate.id,
          locationId: origin.locationId,
          locationName: JEBEL_ALI_CHECKPOINTS.tokenGate.name,
          longitude: JEBEL_ALI_CHECKPOINTS.tokenGate.longitude,
          latitude: JEBEL_ALI_CHECKPOINTS.tokenGate.latitude,
          color: 'orange',
          chargeItems: tokenItems,
          routeDistanceKm: Math.min(0.8, totalKm * 0.06),
        });
        markerItems.set(JEBEL_ALI_CHECKPOINTS.tokenGate.id, tokenItems);
      }

      if (gateItems.length > 0) {
        map.set(JEBEL_ALI_CHECKPOINTS.gate.id, {
          id: JEBEL_ALI_CHECKPOINTS.gate.id,
          locationId: origin.locationId,
          locationName: JEBEL_ALI_CHECKPOINTS.gate.name,
          longitude: JEBEL_ALI_CHECKPOINTS.gate.longitude,
          latitude: JEBEL_ALI_CHECKPOINTS.gate.latitude,
          color: 'green',
          chargeItems: gateItems,
          routeDistanceKm: Math.min(2.0, totalKm * 0.12),
        });
        markerItems.set(JEBEL_ALI_CHECKPOINTS.gate.id, gateItems);
      }
    } else {
      // Origin
      map.set('origin', {
        id: 'origin', locationId: origin.locationId,
        locationName: `${origin.name}\n(Origin)`,
        longitude: origin.longitude, latitude: origin.latitude,
        color: 'orange', chargeItems: originItems, isOrigin: true,
        routeDistanceKm: 0,
      });
      markerItems.set('origin', originItems);
    }

    // Intermediate charge markers (not origin, not delivery, not toll)
    for (const item of items) {
      if (!item.locationId ||
          item.locationId === origin.locationId ||
          item.chargeCategory === 'delivery' ||
          item.chargeCategory === 'toll') continue;
      const loc = locations.find(l => l.locationId === item.locationId);
      if (!loc) continue;
      const existing = map.get(item.locationId);
      if (existing) {
        existing.chargeItems.push(item);
        markerItems.get(item.locationId)?.push(item);
      } else {
        const km = kmsAlongRoute(routeCoords, loc.longitude, loc.latitude);
        map.set(item.locationId, {
          id: item.locationId, locationId: item.locationId,
          locationName: loc.name,
          longitude: loc.longitude, latitude: loc.latitude,
          color: item.markerColor || 'orange',
          chargeItems: [item],
          routeDistanceKm: km,
        });
        markerItems.set(item.locationId, [item]);
      }
    }

    // Toll markers at interpolated positions along the route
    const tollItems = items.filter(i => i.chargeCategory === 'toll');
    const tollFractions = [0.35, 0.65];
    tollItems.forEach((item, idx) => {
      if (idx >= tollFractions.length) return;
      const frac = tollFractions[idx];
      const km = totalKm * frac;

      // Walk the route coords to find the exact interpolated point
      let accum = 0;
      let lng = origin.longitude + (destination.longitude - origin.longitude) * frac;
      let lat = origin.latitude  + (destination.latitude  - origin.latitude)  * frac;

      if (routeCoords.length >= 2) {
        for (let i = 1; i < routeCoords.length; i++) {
          const c0 = routeCoords[i - 1], c1 = routeCoords[i];
          if (!c0 || !c1 || c0.length < 2 || c1.length < 2) continue;
          const [x0, y0] = c0, [x1, y1] = c1;
          if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) continue;
          const seg = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 111.32;
          // Skip zero-length segments (identical coord pairs) to avoid NaN
          if (seg < 0.0001) continue;
          if (accum + seg >= km) {
            const t2 = Math.max(0, Math.min(1, (km - accum) / seg));
            lng = x0 + (x1 - x0) * t2;
            lat = y0 + (y1 - y0) * t2;
            break;
          }
          accum += seg;
        }
      }

      // Safety guard — fall back to straight-line interpolation
      if (!isFinite(lng) || !isFinite(lat)) {
        lng = origin.longitude + (destination.longitude - origin.longitude) * frac;
        lat = origin.latitude  + (destination.latitude  - origin.latitude)  * frac;
      }

      const id = `toll-${idx}`;
      map.set(id, {
        id, locationName: `Salik / Road Toll${tollItems.length > 1 ? ` ${idx + 1}` : ''}`,
        longitude: lng, latitude: lat,
        color: 'purple', chargeItems: [item],
        routeDistanceKm: km,
      });
      markerItems.set(id, [item]);
    });

    // Destination (always last — includes trucking & delivery)
    const destItems = items.filter(i => i.chargeCategory === 'delivery' || i.chargeCategory === 'trucking');
    map.set('destination', {
      id: 'destination', locationId: destination.locationId,
      locationName: `${destination.name}\n(Delivery)`,
      longitude: destination.longitude, latitude: destination.latitude,
      color: 'red', chargeItems: destItems, isDestination: true,
      routeDistanceKm: totalKm,
    });
    markerItems.set('destination', destItems);

    // Store for panel sync
    markerItemsRef.current = markerItems;

    // Sort by km (origin first, dest last)
    const arr = Array.from(map.values()).sort(
      (a, b) => (a.routeDistanceKm ?? 0) - (b.routeDistanceKm ?? 0)
    );
    return arr;
  }, [locations]);

  /* ─ Auto-sync Google Sheets on app startup ─ */
  useEffect(() => {
    const cfg = getSheetConfig();
    if (cfg.url && cfg.autoSync) {
      syncRatesFromGoogleSheet(cfg.url).catch(() => {
        // Keep last saved localStorage rates if offline or unreachable
      });
    }
  }, []);

  /* ─ Calculate ─ */
  const handleCalculate = useCallback(async () => {
    if (!originLocation || !destinationLocation) return;
    setIsCalculating(true);
    setHasCalculated(false);
    setAnimComplete(false);
    setDisabledIds(new Set());
    setAmountOverrides({});
    setMarkers([]); setAllItems([]); setRevealedItems([]);
    setRoute(null); setWarnings([]); setHighlightedId(null);

    try {
      const isJebelAliOrigin = originId === 'jebel-ali-port';
      // Start Mapbox driving route on the eastbound highway ramp just outside Exit Gate
      // so Mapbox doesn't U-turn on internal one-way port roads
      const routeStart: [number, number] = isJebelAliOrigin
        ? [55.0915, 25.0110]
        : [originLocation.longitude, originLocation.latitude];
      const rawRouteInfo = await getRoute(
        routeStart,
        [destinationLocation.longitude, destinationLocation.latitude],
      );
      const routeInfo: RouteInfo | null = rawRouteInfo && isJebelAliOrigin
        ? {
            ...rawRouteInfo,
            geometry: {
              ...rawRouteInfo.geometry,
              coordinates: [
                [JEBEL_ALI_CHECKPOINTS.terminal.longitude, JEBEL_ALI_CHECKPOINTS.terminal.latitude],
                [JEBEL_ALI_CHECKPOINTS.tokenGate.longitude, JEBEL_ALI_CHECKPOINTS.tokenGate.latitude],
                [55.069486, 24.9924],
                [55.070418, 24.993307],
                [55.073603, 24.995984],
                [55.076673, 24.998644],
                [55.079914, 25.00163],
                [55.081511, 25.003086],
                [55.082029, 25.003356],
                [55.08243, 25.003647],
                [55.083338, 25.004654],
                [55.086471, 25.00737],
                [55.089543, 25.010031],
                [55.090975, 25.011392],
                ...rawRouteInfo.geometry.coordinates,
              ],
            },
          }
        : rawRouteInfo;
      setRoute(routeInfo);

      const result = calculatePricing(getRates(), locations, {
        mode, shipmentFlow, originLocationId: originId, destinationLocationId: destinationId,
        containerType, vehicleType,
        externalFreightAmount: externalFreight,
        externalFreightCarrier: externalCarrier,
      });

      const items = result.items;

      setAllItems(items);
      setWarnings(result.warnings);

      const coords = routeInfo?.geometry.coordinates as number[][] ?? [];
      const totalKm = routeInfo?.distance ?? 0;
      const builtMarkers = buildMarkers(items, originLocation, destinationLocation, coords, totalKm);
      setMarkers(builtMarkers);
      setHasCalculated(true);
      setIsAnimating(true); // start journey animation

    } catch (err) {
      console.error(err);
      setWarnings(['Calculation error. Check your connection and try again.']);
    } finally {
      setIsCalculating(false);
    }
  }, [
    originLocation, destinationLocation, mode, shipmentFlow, originId, destinationId,
    containerType, vehicleType, externalFreight, externalCarrier,
    locations, buildMarkers,
  ]);

  /* ─ Called by FreightMap as each marker appears ─ */
  const handleMarkerRevealed = useCallback((markerId: string) => {
    const items = markerItemsRef.current.get(markerId) ?? [];
    if (items.length > 0) {
      setRevealedItems(prev => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(i => i.id));
        const newOnes = items.filter(i => !existingIds.has(i.id));
        return [...prev, ...newOnes];
      });
    }
  }, []);

  /* ─ Called when animation finishes ─ */
  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
    setAnimComplete(true);
    // Show all items
    setRevealedItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      return [...prev, ...allItems.filter(i => !existingIds.has(i.id))];
    });
    // Recalculate totals with final items
    const total = allItems.reduce((s, i) => s + i.total, 0);
    const { sellingPrice: sp, margin: mg } = applyMarkup(total, markup, markupType);
    setSellingPrice(sp); setMargin(mg);
  }, [allItems, markup, markupType]);

  const handleMarkupChange = useCallback((v: number) => {
    setMarkup(v);
    const total = allItems.reduce((s, i) => s + i.total, 0);
    const { sellingPrice: sp, margin: mg } = applyMarkup(total, v, markupType);
    setSellingPrice(sp); setMargin(mg);
  }, [allItems, markupType]);

  const handleMarkupTypeChange = useCallback((t: 'percentage' | 'fixed') => {
    setMarkupType(t);
    const total = allItems.reduce((s, i) => s + i.total, 0);
    const { sellingPrice: sp, margin: mg } = applyMarkup(total, markup, t);
    setSellingPrice(sp); setMargin(mg);
  }, [allItems, markup]);

  const handleItemClick    = (id: string) => setHighlightedId(p => p === id ? null : id);
  const handleMarkerClick  = (id: string) => {
    const m = markers.find(m => m.id === id);
    if (m?.chargeItems[0]) setHighlightedId(m.chargeItems[0].id);
  };

  const handleModeChange = (m: TransportMode) => {
    setMode(m); setHasCalculated(false); setAnimComplete(false);
    setMarkers([]); setAllItems([]); setRevealedItems([]);
    setRoute(null); setWarnings([]); setIsAnimating(false);
  };

  const effectiveRevealedItems = useMemo(
    () =>
      revealedItems.map(item =>
        amountOverrides[item.id] !== undefined
          ? { ...item, amount: amountOverrides[item.id], total: amountOverrides[item.id] * item.quantity }
          : item,
      ),
    [revealedItems, amountOverrides],
  );

  // Totals shown in panel (excluding unchecked items)
  const panelTotal = effectiveRevealedItems
    .filter(i => !disabledIds.has(i.id))
    .reduce((s, i) => s + i.total, 0);
  const { sellingPrice: panelSP, margin: panelMargin } = applyMarkup(panelTotal, markup, markupType);

  const handleToggleItem = useCallback((id: string) => {
    setDisabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAmountChange = useCallback((id: string, amount: number) => {
    setAmountOverrides(prev => ({ ...prev, [id]: amount }));
  }, []);

  return (
    <>
      <TopBar
        mode={mode} onModeChange={handleModeChange}
        shipmentFlow={shipmentFlow} onShipmentFlowChange={setShipmentFlow}
        originId={originId} destinationId={destinationId}
        onOriginChange={setOriginId} onDestinationChange={setDestinationId}
        containerType={containerType} vehicleType={vehicleType}
        onContainerTypeChange={setContainerType} onVehicleTypeChange={setVehicleType}
        onCalculate={handleCalculate} isCalculating={isCalculating}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative' }}>
          <FreightMap
            markers={markers}
            route={route}
            highlightedMarkerId={highlightedId}
            onMarkerClick={handleMarkerClick}
            isAnimating={isAnimating}
            onMarkerRevealed={handleMarkerRevealed}
            onAnimationComplete={handleAnimationComplete}
          />
        </div>

        <QuotationPanel
          mode={mode}
          originLocation={originLocation}
          destinationLocation={destinationLocation}
          containerType={containerType}
          vehicleType={vehicleType}
          route={route}
          items={effectiveRevealedItems}
          allItemsCount={allItems.length}
          externalFreight={externalFreight}
          externalCarrier={externalCarrier}
          onExternalFreightChange={setExternalFreight}
          onExternalCarrierChange={setExternalCarrier}
          markup={markup}
          markupType={markupType}
          onMarkupChange={handleMarkupChange}
          onMarkupTypeChange={handleMarkupTypeChange}
          totalCost={panelTotal}
          sellingPrice={panelSP}
          margin={panelMargin}
          highlightedItemId={highlightedId}
          onItemClick={handleItemClick}
          disabledIds={disabledIds}
          onToggleItem={handleToggleItem}
          onAmountChange={handleAmountChange}
          onSave={() => alert('💾 Firebase not configured.\n\nAdd Firebase credentials to .env.local to enable saving.')}
          onExportPDF={() => alert('📄 PDF export will be built in Phase 5.')}
          warnings={warnings}
          hasCalculated={hasCalculated}
          isAnimating={isAnimating}
          animComplete={animComplete}
        />
      </div>
    </>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [activeNav, setActiveNav] = useState<NavItem>('new-quotation');

  const content: Record<NavItem, React.ReactNode> = {
    'new-quotation':   <NewQuotationView />,
    quotations:        <PlaceholderPage title="Quotations"      icon="📋" phase="Phase 3" description="View, search and manage all saved quotations. Send to customers and track their status." />,
    'rate-management': <RateManagement />,
    locations:         <PlaceholderPage title="Locations"       icon="📍" phase="Phase 3" description="Manage UAE ports, airports, free zones and delivery addresses." />,
    reports:           <PlaceholderPage title="Reports"         icon="📈" phase="Phase 5" description="Pricing reports, quotation history, revenue and margin tracking." />,
    settings:          <PlaceholderPage title="Settings"        icon="⚙️" phase="Phase 5" description="Configure company profile, markup, currency, PDF branding and user accounts." />,
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      overflow: 'hidden', backgroundColor: '#f8fafc', minWidth: 900,
    }}>
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {content[activeNav]}
      </div>
    </div>
  );
}
