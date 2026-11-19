// src/components/map/FreightMap.tsx
// Truck-journey animation: route draws forward, markers appear as line reaches them
'use client';

import { useEffect, useRef, useState } from 'react';
import { MapMarker, RouteInfo } from '@/types';
import { MAPBOX_TOKEN, MAP_STYLES, MapStyleKey } from '@/lib/mapbox/config';
import { UAE_MAP_CENTER, UAE_MAP_ZOOM } from '@/constants/locations';

interface FreightMapProps {
  markers: MapMarker[];
  route: RouteInfo | null;
  highlightedMarkerId?: string | null;
  onMarkerClick: (markerId: string) => void;
  isAnimating: boolean;
  onMarkerRevealed?: (markerId: string) => void;
  onAnimationComplete?: () => void;
}

/* ─── visual constants ───────────────────────────────────────────────────── */
const COLORS: Record<string, string> = {
  green: '#16a34a', orange: '#ea580c',
  purple: '#9333ea', blue: '#2563eb', red: '#dc2626',
};
const EMOJI: Record<string, string> = {
  green: '⚓', orange: '🏭', purple: '🛣️', blue: '🚛', red: '🚩',
};

const ANIM_DURATION_MS = 7000; // 7 s end-to-end journey

/* ─── helpers ────────────────────────────────────────────────────────────── */
function easeOut(t: number) { return 1 - Math.pow(1 - t, 1.6); }

function buildPopupHTML(marker: MapMarker, accentColor: string): string {
  const hasCharges = marker.chargeItems.length > 0;
  let html = `
    <div style="padding:12px 14px;font-family:-apple-system,sans-serif;min-width:200px;max-width:260px;">
      <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:8px;
                  padding-bottom:6px;border-bottom:2.5px solid ${accentColor};">
        ${marker.locationName.replace(/\n/g, ' ')}
      </div>`;
  if (hasCharges) {
    html += marker.chargeItems.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
                  padding:5px 0;border-top:1px solid #f1f5f9;">
        <div>
          <div style="font-size:12px;color:#374151;">${item.chargeName}</div>
          <div style="font-size:10px;color:#9ca3af;">${item.unit.replace(/_/g,' ')}</div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-left:12px;white-space:nowrap;">
          ${item.currency} ${item.total.toLocaleString('en-US',{minimumFractionDigits:2})}
        </div>
      </div>`).join('');
    const sub = marker.chargeItems.reduce((s, i) => s + i.total, 0);
    html += `
      <div style="margin-top:8px;padding-top:6px;border-top:2px solid ${accentColor};
                  display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#6b7280;font-weight:600;">Subtotal</span>
        <span style="font-size:14px;font-weight:800;color:${accentColor};">
          AED ${sub.toLocaleString('en-US',{minimumFractionDigits:2})}
        </span>
      </div>`;
  } else {
    html += `<div style="font-size:12px;color:#9ca3af;text-align:center;padding:6px 0;">
      ${marker.isOrigin ? 'Journey starts here' : 'Final destination'}
    </div>`;
  }
  html += `</div>`;
  return html;
}

/* ─── component ──────────────────────────────────────────────────────────── */
export default function FreightMap({
  markers, route,
  highlightedMarkerId, onMarkerClick,
  isAnimating,
  onMarkerRevealed = () => { /* noop */ },
  onAnimationComplete = () => { /* noop */ },
}: FreightMapProps) {

  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<unknown>(null);
  const markerEls     = useRef<Map<string, { mapMarker: unknown; popup: unknown }>>(new Map());
  const rafRef        = useRef<number | null>(null);
  const revealedRef   = useRef<Set<string>>(new Set());

  const [mapStyle, setMapStyle]   = useState<MapStyleKey>('satellite');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError]   = useState<string | null>(null);
  const [animBanner, setAnimBanner] = useState(false);

  /* ── init map once ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!MAPBOX_TOKEN) { setMapError('Mapbox token not set in .env.local'); return; }
    if (mapRef.current) return;
    let dead = false;

    import('mapbox-gl').then(mgl => {
      if (dead || !containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = mgl.default as any;
      G.accessToken = MAPBOX_TOKEN;
      const map = new G.Map({
        container: containerRef.current,
        style: MAP_STYLES[mapStyle],
        center: UAE_MAP_CENTER, zoom: UAE_MAP_ZOOM,
        pitch: 0, bearing: 0, antialias: false,
      });
      map.on('load', () => { if (!dead) { setMapLoaded(true); mapRef.current = map; } });
      map.on('error', (e: { error: Error }) => console.error(e.error));
    }).catch(e => { if (!dead) setMapError(e.message); });

    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── style switch ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapRef.current as any).setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle, mapLoaded]);

  /* ── add / remove a single marker ─────────────────────────────────────── */
  function addMarker(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MapboxGL: any, map: any,
    marker: MapMarker,
    autoOpenPopup: boolean,
    highlighted: boolean,
  ) {
    const color = COLORS[marker.color] || '#2563eb';

    const el = document.createElement('div');
    el.style.cssText = `
      position:relative;
      width:${highlighted?46:38}px; height:${highlighted?46:38}px;
      cursor:pointer;
      animation: markerDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
    `;

    // Pulse ring
    const ring = document.createElement('div');
    ring.style.cssText = `
      position:absolute;inset:-7px;border-radius:50%;
      border:2.5px solid ${color};opacity:0;
      animation:pulseRing 1.6s ease-out ${autoOpenPopup ? 'infinite' : '1'};
    `;
    el.appendChild(ring);

    const pin = document.createElement('div');
    pin.style.cssText = `
      width:100%;height:100%;background:${color};
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:3px solid white;
      box-shadow:0 3px 12px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
    `;
    const icon = document.createElement('div');
    icon.style.cssText = `transform:rotate(45deg);font-size:${highlighted?17:14}px;line-height:1;`;
    icon.textContent = EMOJI[marker.color] || '📍';
    pin.appendChild(icon);
    el.appendChild(pin);

    // Always-visible label for origin / dest
    if (marker.isOrigin || marker.isDestination) {
      const lbl = document.createElement('div');
      const lines = marker.locationName.split('\n');
      lbl.style.cssText = `
        position:absolute;bottom:112%;left:50%;transform:translateX(-50%);
        background:white;border:2px solid ${color};
        border-radius:8px;padding:4px 10px;white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none;
        animation:fadeUp 0.35s ease both;
      `;
      lbl.innerHTML = lines.map((l, i) =>
        `<div style="text-align:center;font-size:${i===0?12:10}px;
         font-weight:${i===0?700:500};color:${i===0?'#1e293b':'#64748b'}">${l}</div>`
      ).join('');
      el.appendChild(lbl);
    }

    const popup = new MapboxGL.Popup({
      offset: 30, closeButton: true, maxWidth: '280px', closeOnClick: false,
    }).setHTML(buildPopupHTML(marker, color));

    const mapMarker = new MapboxGL.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([
        isFinite(marker.longitude) ? marker.longitude : 55.27,
        isFinite(marker.latitude)  ? marker.latitude  : 25.20,
      ])
      .setPopup(popup)
      .addTo(map);

    if (autoOpenPopup && marker.chargeItems.length > 0) {
      setTimeout(() => { try { mapMarker.getPopup().addTo(map); } catch { /* noop */ } }, 350);
    }

    el.addEventListener('click', () => {
      onMarkerClick(marker.id);
    });

    markerEls.current.set(marker.id, { mapMarker, popup });
  }

  function removeAllMarkers() {
    markerEls.current.forEach(({ mapMarker, popup }) => {
      try { (popup as { remove: () => void }).remove(); } catch { /* noop */ }
      try { (mapMarker as { remove: () => void }).remove(); } catch { /* noop */ }
    });
    markerEls.current.clear();
  }

  /* ── main route + animation effect ────────────────────────────────────── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !route || markers.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapRef.current as any;

    // Cancel any running animation
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    revealedRef.current = new Set();
    removeAllMarkers();

    // ── Draw helpers ──────────────────────────────────────────────────────
    const setupRouteLayers = (coords: number[][]) => {
      if (map.getLayer('route-line'))   map.removeLayer('route-line');
      if (map.getLayer('route-casing')) map.removeLayer('route-casing');
      if (map.getSource('route'))       map.removeSource('route');

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      });
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': 'white', 'line-width': 7, 'line-opacity': 0.75 },
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 4.5, 'line-opacity': 0.95 },
      });
    };

    const updateRouteCoords = (coords: number[][]) => {
      const src = map.getSource('route');
      if (src) src.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    };

    const fullCoords = route.geometry.coordinates as number[][];
    const totalKm    = route.distance;

    // Sort markers by distance along route
    const sorted = [...markers].sort(
      (a, b) => (a.routeDistanceKm ?? 0) - (b.routeDistanceKm ?? 0)
    );

    if (!isAnimating) {
      // ── Instant mode: show everything immediately ────────────────────────
      const run = () => {
        setupRouteLayers(fullCoords);
        import('mapbox-gl').then(mgl => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const G = mgl.default as any;
          markers.forEach(m => addMarker(G, map, m, false, m.id === highlightedMarkerId));
        });
        // Fit map
        const validM = markers.filter(m => isFinite(m.longitude) && isFinite(m.latitude));
        if (validM.length >= 2) {
          const lngs = validM.map(m => m.longitude);
          const lats  = validM.map(m => m.latitude);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 100, duration: 1000 }
          );
        }
      };
      if (map.isStyleLoaded()) run(); else map.once('styledata', run);
      return;
    }

    // ── Animated journey mode ───────────────────────────────────────────────
    setAnimBanner(true);

    // Helper: get coords slice for a given km progress
    function coordsForKm(km: number): number[][] {
      if (km <= 0) return [fullCoords[0]];
      if (km >= totalKm) return fullCoords;

      // Calculate cumulative distances per segment
      let accum = 0;
      const result: number[][] = [fullCoords[0]];

      for (let i = 1; i < fullCoords.length; i++) {
        const c0 = fullCoords[i - 1], c1 = fullCoords[i];
        if (!c0 || !c1) continue;
        const [x0, y0] = c0, [x1, y1] = c1;
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) continue;
        const segKm = Math.sqrt((x1-x0)**2 + (y1-y0)**2) * 111.32;
        // Skip zero-length segments to avoid NaN from 0/0
        if (segKm < 0.0001) { result.push(c1); continue; }
        const next = accum + segKm;

        if (next >= km) {
          // Interpolate within this segment
          const frac = Math.max(0, Math.min(1, (km - accum) / segKm));
          result.push([x0 + (x1-x0)*frac, y0 + (y1-y0)*frac]);
          break;
        }
        result.push(c1);
        accum = next;
      }
      return result;
    }

    const startAnim = () => {
      // Start with just origin point
      setupRouteLayers([fullCoords[0]]);

      import('mapbox-gl').then(mgl => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const G = mgl.default as any;

        // Show origin marker immediately
        const origin = sorted[0];
        if (origin) {
          addMarker(G, map, origin, true, false);
          revealedRef.current.add(origin.id);
          onMarkerRevealed?.(origin.id);
          // Fly to origin first
          map.flyTo({ center: [origin.longitude, origin.latitude], zoom: 11, duration: 800 });
        }

        const startTime = performance.now();

        const frame = () => {
          const elapsed = performance.now() - startTime;
          const t        = Math.min(elapsed / ANIM_DURATION_MS, 1);
          const progress = easeOut(t);
          const currentKm = totalKm * progress;

          // Update route line
          updateRouteCoords(coordsForKm(currentKm));

          // Reveal markers whose position has been passed
          for (const marker of sorted) {
            const dist = marker.routeDistanceKm ?? 0;
            if (dist <= currentKm && !revealedRef.current.has(marker.id)) {
              // Skip markers with invalid coordinates
              if (!isFinite(marker.longitude) || !isFinite(marker.latitude)) {
                revealedRef.current.add(marker.id);
                continue;
              }
              revealedRef.current.add(marker.id);
              addMarker(G, map, marker, true, false);
              onMarkerRevealed(marker.id);
              // Pan camera to follow
              map.panTo([marker.longitude, marker.latitude], { duration: 600 });
            }
          }

          if (t < 1) {
            rafRef.current = requestAnimationFrame(frame);
          } else {
            // Done — ensure all markers visible + fit bounds
            setAnimBanner(false);
            markers.forEach(m => {
              if (!revealedRef.current.has(m.id)) {
                addMarker(G, map, m, false, false);
                revealedRef.current.add(m.id);
              }
            });
            const validMarkers = markers.filter(m => isFinite(m.longitude) && isFinite(m.latitude));
            if (validMarkers.length >= 2) {
              const lngs = validMarkers.map(m => m.longitude);
              const lats  = validMarkers.map(m => m.latitude);
              map.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: 110, duration: 1200 }
              );
            }
            onAnimationComplete();
          }
        };

        rafRef.current = requestAnimationFrame(frame);
      });
    };

    if (map.isStyleLoaded()) startAnim(); else map.once('styledata', startAnim);

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAnimBanner(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, mapLoaded, route, markers]);

  /* ── highlight marker (re-render that one marker) ──────────────────────── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !highlightedMarkerId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapRef.current as any;
    const entry = markerEls.current.get(highlightedMarkerId);
    if (entry) {
      const ll = (entry.mapMarker as { getLngLat: () => { lng: number; lat: number } }).getLngLat();
      map.flyTo({ center: [ll.lng, ll.lat], zoom: Math.max(map.getZoom(), 12), duration: 600 });
    }
  }, [highlightedMarkerId, mapLoaded]);

  /* ── style toggle ───────────────────────────────────────────────────────── */
  const styleBtn = (k: MapStyleKey, label: string) => (
    <button key={k} onClick={() => setMapStyle(k)} style={{
      padding: '4px 11px', border: 'none', cursor: 'pointer', fontSize: 12,
      fontWeight: mapStyle === k ? 700 : 400, borderRadius: 4, transition: 'all 0.15s',
      backgroundColor: mapStyle === k ? '#2563eb' : 'rgba(255,255,255,0.93)',
      color: mapStyle === k ? 'white' : '#1e293b',
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
      <style>{`
        @keyframes markerDrop {
          0%   { transform: translateY(-28px) scale(0.3); opacity: 0; }
          65%  { transform: translateY(5px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulseRing {
          0%   { transform:scale(0.85); opacity:0.9; }
          80%  { transform:scale(1.8);  opacity:0; }
          100% { transform:scale(1.8);  opacity:0; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateX(-50%) translateY(8px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Style switcher */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        display: 'flex', gap: 2,
        backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 6, padding: 2,
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}>
        {styleBtn('map', 'Map')}
        {styleBtn('satellite', 'Satellite')}
        {styleBtn('streets', 'Streets')}
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 50, left: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[{ l: '+', fn: () => (mapRef.current as { zoomIn?: () => void })?.zoomIn?.() },
          { l: '−', fn: () => (mapRef.current as { zoomOut?: () => void })?.zoomOut?.() }]
          .map(({ l, fn }) => (
          <button key={l} onClick={fn} style={{
            width: 30, height: 30, backgroundColor: 'white', border: 'none',
            borderRadius: 4, cursor: 'pointer', fontSize: 18, fontWeight: 300,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{l}</button>
        ))}
      </div>

      {/* Journey animation banner */}
      {animBanner && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(8px)',
          color: 'white', padding: '9px 22px', borderRadius: 24,
          fontSize: 12, fontWeight: 600, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', backgroundColor: '#60a5fa',
            display: 'inline-block', animation: 'pulseRing 1.2s ease-out infinite',
          }} />
          Tracing shipment journey…
        </div>
      )}

      {/* Error */}
      {mapError && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#0f172a',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', color: 'white', gap: 12, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }}>🗺️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Map not available</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 320 }}>{mapError}</div>
        </div>
      )}

      {/* Loading */}
      {!mapLoaded && !mapError && MAPBOX_TOKEN && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: 13,
        }}>
          Loading UAE satellite map…
        </div>
      )}
    </div>
  );
}
