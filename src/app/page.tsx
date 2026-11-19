// src/app/page.tsx
'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar, { NavItem } from '@/components/layout/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import QuotationPanel from '@/components/pricing/QuotationPanel';
import {
  TransportMode, ContainerType, VehicleType,
  Location, MapMarker, QuotationItem, RouteInfo,
} from '@/types';
import { UAE_LOCATIONS } from '@/constants/locations';
import { getRoute } from '@/lib/mapbox/directions';
import { calculatePricing, applyMarkup } from '@/lib/pricing/engine';
import { DEMO_RATES, DEMO_TOLL_ITEMS } from '@/lib/pricing/demo-rates';

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
  // Find nearest point on the polyline and return accumulated km to it
  let best = Infinity;
  let bestKm = 0;
  let accum = 0;

  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1];
    const [x1, y1] = coords[i];
    const segKm = Math.sqrt((x1-x0)**2 + (y1-y0)**2) * 111.32;

    // Project point onto segment
    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx*dx + dy*dy;
    let t = lenSq > 0 ? ((targetLng-x0)*dx + (targetLat-y0)*dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t*dx, py = y0 + t*dy;
    const dist = Math.sqrt((targetLng-px)**2 + (targetLat-py)**2);

    if (dist < best) {
      best = dist;
      bestKm = accum + t * segKm;
    }
    accum += segKm;
  }
  return bestKm;
}

/* ─── New Quotation view ─────────────────────────────────────────────────── */
function NewQuotationView() {
  const [mode, setMode]                       = useState<TransportMode>('land');
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

    // Origin
    map.set('origin', {
      id: 'origin', locationId: origin.locationId,
      locationName: `${origin.name}\n(Origin)`,
      longitude: origin.longitude, latitude: origin.latitude,
      color: 'green', chargeItems: [], isOrigin: true,
      routeDistanceKm: 0,
    });
    markerItems.set('origin', []);

    // Charge markers (non-toll, non-delivery)
    for (const item of items) {
      if (!item.locationId || item.chargeCategory === 'delivery' || item.chargeCategory === 'toll') continue;
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
      // Find coord at that km
      let accum = 0;
      let lng = origin.longitude + (destination.longitude - origin.longitude) * frac;
      let lat = origin.latitude  + (destination.latitude  - origin.latitude)  * frac;
      for (let i = 1; i < routeCoords.length; i++) {
        const [x0,y0] = routeCoords[i-1], [x1,y1] = routeCoords[i];
        const seg = Math.sqrt((x1-x0)**2+(y1-y0)**2)*111.32;
        if (accum + seg >= km) {
          const t2 = (km - accum) / seg;
          lng = x0 + (x1-x0)*t2; lat = y0 + (y1-y0)*t2;
          break;
        }
        accum += seg;
      }
      const id = `toll-${idx}`;
      map.set(id, {
        id, locationName: item.locationName || `Toll Gate ${idx+1}`,
        longitude: lng, latitude: lat,
        color: 'purple', chargeItems: [item],
        routeDistanceKm: km,
      });
      markerItems.set(id, [item]);
    });

    // Destination (always last)
    const destItems = items.filter(i => i.chargeCategory === 'delivery');
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

  /* ─ Calculate ─ */
  const handleCalculate = useCallback(async () => {
    if (!originLocation || !destinationLocation) return;
    setIsCalculating(true);
    setHasCalculated(false);
    setAnimComplete(false);
    setMarkers([]); setAllItems([]); setRevealedItems([]);
    setRoute(null); setWarnings([]); setHighlightedId(null);

    try {
      const routeInfo = await getRoute(
        [originLocation.longitude, originLocation.latitude],
        [destinationLocation.longitude, destinationLocation.latitude],
      );
      setRoute(routeInfo);

      const result = calculatePricing(DEMO_RATES, locations, {
        mode, originLocationId: originId, destinationLocationId: destinationId,
        containerType, vehicleType,
        externalFreightAmount: externalFreight,
        externalFreightCarrier: externalCarrier,
      });

      let items = result.items;
      if (mode === 'land' && routeInfo) items = [...items, ...DEMO_TOLL_ITEMS];

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
    originLocation, destinationLocation, mode, originId, destinationId,
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

  // Totals shown in panel (from revealed items during animation)
  const panelTotal = revealedItems.reduce((s, i) => s + i.total, 0);
  const { sellingPrice: panelSP } = applyMarkup(panelTotal, markup, markupType);

  return (
    <>
      <TopBar
        mode={mode} onModeChange={handleModeChange}
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
          items={revealedItems}
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
          sellingPrice={animComplete ? sellingPrice : panelSP}
          margin={margin}
          highlightedItemId={highlightedId}
          onItemClick={handleItemClick}
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
    'rate-management': <PlaceholderPage title="Rate Management" icon="📊" phase="Phase 3" description="Import and manage your company rate master from Excel. Set terminal, trucking, toll and delivery rates by route." />,
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
