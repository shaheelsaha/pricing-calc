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

function getAnimDurationMs(distanceKm: number): number {
  const km = isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  return Math.min(13000, Math.max(4500, 3500 + km * 75));
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function easeOut(t: number) { return 1 - Math.pow(1 - t, 1.6); }

function buildPopupHTML(marker: MapMarker, accentColor: string): string {
  const hasCharges = marker.chargeItems.length > 0;
  const isMulti = marker.chargeItems.length > 1;
  const sub = marker.chargeItems.reduce((s, i) => s + i.total, 0);

  let html = `
    <div style="padding:7px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:130px;max-width:185px;">
      <div style="font-weight:700;font-size:11px;color:#0f172a;line-height:1.2;margin-bottom:3px;padding-right:16px;
                  padding-bottom:3px;border-bottom:1.5px solid ${accentColor};display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${marker.locationName.replace(/\n/g, ' ')}</span>
        ${!isMulti && hasCharges ? `<span style="font-size:11px;font-weight:800;color:${accentColor};white-space:nowrap;">${marker.chargeItems[0].isAtActual && sub === 0 ? 'At Actuals' : `AED ${sub.toLocaleString('en-US',{minimumFractionDigits:2})}`}</span>` : ''}
      </div>`;

  if (hasCharges) {
    if (isMulti) {
      html += marker.chargeItems.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:1.5px 0;font-size:9.5px;">
          <span style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:95px;" title="${item.chargeName}">
            ${item.chargeName}
          </span>
          <span style="font-weight:700;color:#0f172a;margin-left:4px;white-space:nowrap;">
            ${item.isAtActual && item.total === 0 ? 'At Actuals' : item.total.toLocaleString('en-US',{minimumFractionDigits:2})}
          </span>
        </div>`).join('');

      html += `
        <div style="margin-top:3px;padding-top:3px;border-top:1px dashed #cbd5e1;
                    display:flex;justify-content:space-between;align-items:center;font-size:9.5px;">
          <span style="color:#64748b;font-weight:600;">Total</span>
          <span style="font-size:11px;font-weight:800;color:${accentColor};">
            AED ${sub.toLocaleString('en-US',{minimumFractionDigits:2})}
          </span>
        </div>`;
    } else {
      const item = marker.chargeItems[0];
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748b;padding-top:1px;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:95px;">${item.chargeName}</span>
          <span style="white-space:nowrap;">${item.unit.replace(/_/g, ' ')}</span>
        </div>`;
    }
  } else {
    html += `<div style="font-size:9.5px;color:#64748b;text-align:center;padding:1px 0;">
      ${marker.isOrigin ? 'Origin' : 'Final Destination'}
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
  const activePopupRef = useRef<unknown>(null);
  const hasCompletedAnimRef = useRef(false);
  const lastRouteKeyRef = useRef<string | null>(null);
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
    el.className = 'freight-marker-root';
    el.style.cssText = `
      width:${highlighted ? 34 : 28}px; height:${highlighted ? 34 : 28}px;
      cursor:pointer;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      position:relative;
      width:100%;
      height:100%;
      animation: markerDrop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
    `;
    el.appendChild(inner);

    // Pulse ring
    const ring = document.createElement('div');
    ring.style.cssText = `
      position:absolute;inset:-5px;border-radius:50%;
      border:2px solid ${color};opacity:0;
      animation:pulseRing 1.5s ease-out ${autoOpenPopup ? 'infinite' : '1'};
    `;
    inner.appendChild(ring);

    const pin = document.createElement('div');
    pin.style.cssText = `
      width:100%;height:100%;background:${color};
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:2.5px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    `;
    const icon = document.createElement('div');
    icon.style.cssText = `transform:rotate(45deg);font-size:${highlighted ? 13 : 11}px;line-height:1;`;
    icon.textContent = EMOJI[marker.color] || '📍';
    pin.appendChild(icon);
    inner.appendChild(pin);

    // Always-visible label for origin / dest
    if (marker.isOrigin || marker.isDestination) {
      const lbl = document.createElement('div');
      const lines = marker.locationName.split('\n');
      lbl.style.cssText = `
        position:absolute;bottom:108%;left:50%;transform:translateX(-50%);
        background:rgba(255,255,255,0.96);border:1.5px solid ${color};
        border-radius:5px;padding:2px 7px;white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.22);pointer-events:none;
        animation:fadeUp 0.35s ease both;
      `;
      lbl.innerHTML = lines.map((l, i) =>
        `<div style="text-align:center;font-size:${i===0?10.5:9}px;
         font-weight:${i===0?700:500};color:${i===0?'#1e293b':'#64748b'};line-height:1.2;">${l}</div>`
      ).join('');
      inner.appendChild(lbl);
    }

    const lng = isFinite(marker.longitude) ? marker.longitude : 55.27;
    const lat = isFinite(marker.latitude)  ? marker.latitude  : 25.20;

    const popup = new MapboxGL.Popup({
      offset: 18, closeButton: true, maxWidth: '185px', closeOnClick: false,
    })
      .setLngLat([lng, lat])
      .setHTML(buildPopupHTML(marker, color));

    popup.on('close', () => {
      if (activePopupRef.current === popup) {
        activePopupRef.current = null;
      }
    });

    const mapMarker = new MapboxGL.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

    if (autoOpenPopup && marker.chargeItems.length > 0) {
      // Close previous popup so they don't stack / clump over each other
      if (activePopupRef.current) {
        try { (activePopupRef.current as { remove: () => void }).remove(); } catch { /* noop */ }
      }
      try {
        popup.addTo(map);
        activePopupRef.current = popup;
      } catch { /* noop */ }
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onMarkerClick(marker.id);
      if (activePopupRef.current && activePopupRef.current !== popup) {
        try { (activePopupRef.current as { remove: () => void }).remove(); } catch { /* noop */ }
      }
      try {
        popup.addTo(map);
        activePopupRef.current = popup;
      } catch { /* noop */ }
    });

    markerEls.current.set(marker.id, { mapMarker, popup });
  }

  function removeAllMarkers() {
    if (activePopupRef.current) {
      try { (activePopupRef.current as { remove: () => void }).remove(); } catch { /* noop */ }
      activePopupRef.current = null;
    }
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

    const routeKey = `${route.distance}-${markers.map(m=>m.id).join(',')}`;
    const routeChanged = routeKey !== lastRouteKeyRef.current;
    if (routeChanged) {
      lastRouteKeyRef.current = routeKey;
      hasCompletedAnimRef.current = false;
    }

    // If animation has completed and isAnimating is now false, don't tear down the map!
    if (!isAnimating && hasCompletedAnimRef.current) {
      return;
    }

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
          // Reveal all detail cards on screen
          setTimeout(() => {
            markers.forEach(m => {
              if (m.chargeItems.length > 0) {
                const entry = markerEls.current.get(m.id);
                if (entry) {
                  try { (entry.popup as { addTo: (m: unknown) => void }).addTo(map); } catch { /* noop */ }
                }
              }
            });
          }, 400);
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

    let cancelled = false;
    let introTimer: ReturnType<typeof setTimeout> | null = null;

    const startAnim = () => {
      if (cancelled) return;
      // Start with just origin point
      setupRouteLayers([fullCoords[0]]);

      import('mapbox-gl').then(mgl => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const G = mgl.default as any;

        // Compute full-route bounding box so gradual zoom-out frames the entire path
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (const pt of fullCoords) {
          if (pt && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1])) {
            if (pt[0] < minLng) minLng = pt[0];
            if (pt[0] > maxLng) maxLng = pt[0];
            if (pt[1] < minLat) minLat = pt[1];
            if (pt[1] > maxLat) maxLat = pt[1];
          }
        }
        const hasRouteBounds = isFinite(minLng) && isFinite(maxLng) && isFinite(minLat) && isFinite(maxLat);

        const origin = sorted[0];
        const startLng = origin && isFinite(origin.longitude) ? origin.longitude : fullCoords[0][0];
        const startLat = origin && isFinite(origin.latitude) ? origin.latitude : fullCoords[0][1];

        let endLng = startLng;
        let endLat = startLat;
        let endZoom = 10;

        if (hasRouteBounds) {
          const cam = map.cameraForBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 110 }
          );
          if (cam && cam.center && isFinite(cam.zoom)) {
            const c = cam.center;
            endLng = typeof c.lng === 'number' ? c.lng : c[0];
            endLat = typeof c.lat === 'number' ? c.lat : c[1];
            endZoom = cam.zoom;
          }
        }

        const startZoom = Math.min(14.6, Math.max(13.6, endZoom + 3.4));

        // Smoothly zoom in close to the first checkpoint (Port/Terminal), then start checkpoint tour
        map.flyTo({ center: [startLng, startLat], zoom: startZoom, duration: 950, essential: true });

        introTimer = setTimeout(() => {
          if (cancelled) return;

          if (origin) {
            addMarker(G, map, origin, true, false);
            revealedRef.current.add(origin.id);
            onMarkerRevealed?.(origin.id);
          }

          const hasPortCheckpoints = sorted.some(m => m.id.startsWith('checkpoint-'));
          const portEndKm = Math.min(totalKm * 0.25, 2.2);
          const animDurationMs = getAnimDurationMs(totalKm) + (hasPortCheckpoints ? 3200 : 0);
          const startTime = performance.now();

          const frame = () => {
            if (cancelled) return;
            const elapsed = performance.now() - startTime;
            const t        = Math.min(elapsed / animDurationMs, 1);

            // Dedicate first 35% of animation to smoothly touring Port -> DO -> Token -> Exit Gate
            let currentKm: number;
            let highwayProgress: number;
            if (hasPortCheckpoints && totalKm > portEndKm) {
              if (t <= 0.35) {
                const portT = t / 0.35;
                currentKm = portEndKm * portT;
                highwayProgress = 0;
              } else {
                const hwyT = easeOut((t - 0.35) / 0.65);
                currentKm = portEndKm + (totalKm - portEndKm) * hwyT;
                highwayProgress = hwyT;
              }
            } else {
              highwayProgress = easeOut(t);
              currentKm = totalKm * highwayProgress;
            }

            // Update route line
            updateRouteCoords(coordsForKm(currentKm));

            // Keep close zoom while inside Port / DO / Gate checkpoints, then smoothly zoom out
            if (hasPortCheckpoints && t <= 0.35) {
              const portFrac = t / 0.35;
              const gateMarker = sorted.find(m => m.id === 'checkpoint-gate');
              const targetLng = gateMarker ? startLng + (gateMarker.longitude - startLng) * portFrac : startLng;
              const targetLat = gateMarker ? startLat + (gateMarker.latitude - startLat) * portFrac : startLat;
              if (isFinite(targetLng) && isFinite(targetLat)) {
                map.jumpTo({ center: [targetLng, targetLat], zoom: startZoom - 0.4 * portFrac });
              }
            } else {
              const camProgress = Math.min(1, Math.pow(highwayProgress, 0.85));
              const curLng = startLng + (endLng - startLng) * camProgress;
              const curLat = startLat + (endLat - startLat) * camProgress;
              const curZoom = (startZoom - 0.4) + (endZoom - (startZoom - 0.4)) * camProgress;
              if (isFinite(curLng) && isFinite(curLat) && isFinite(curZoom)) {
                map.jumpTo({ center: [curLng, curLat], zoom: curZoom });
              }
            }

            // Reveal markers whose position has been passed + briefly focus on Toll / Gate checkpoints
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

                if (marker.id.startsWith('checkpoint-') || marker.id.startsWith('toll-')) {
                  map.easeTo({
                    center: [marker.longitude, marker.latitude],
                    zoom: marker.id.startsWith('toll-') ? Math.max(endZoom + 1.4, 12.2) : 14.0,
                    duration: 450,
                  });
                }
              }
            }

            if (t < 1) {
              rafRef.current = requestAnimationFrame(frame);
            } else {
              // Done — ensure all markers visible + settle bounds
              setAnimBanner(false);
              hasCompletedAnimRef.current = true;

              markers.forEach(m => {
                if (!revealedRef.current.has(m.id)) {
                  addMarker(G, map, m, false, false);
                  revealedRef.current.add(m.id);
                }
              });
              if (hasRouteBounds) {
                map.fitBounds(
                  [[minLng, minLat], [maxLng, maxLat]],
                  { padding: 110, duration: 400 }
                );
              }

              // Once journey ends, open all detail cards across the screen!
              activePopupRef.current = null;
              setTimeout(() => {
                if (cancelled) return;
                markers.forEach(m => {
                  if (m.chargeItems.length > 0) {
                    const entry = markerEls.current.get(m.id);
                    if (entry) {
                      try {
                        (entry.popup as { addTo: (m: unknown) => void }).addTo(map);
                      } catch { /* noop */ }
                    }
                  }
                });
              }, 300);

              onAnimationComplete();
            }
          };

          rafRef.current = requestAnimationFrame(frame);
        }, 950);
      });
    };

    if (map.isStyleLoaded()) startAnim(); else map.once('styledata', startAnim);

    return () => {
      cancelled = true;
      if (introTimer) clearTimeout(introTimer);
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
      if (activePopupRef.current && activePopupRef.current !== entry.popup) {
        try { (activePopupRef.current as { remove: () => void }).remove(); } catch { /* noop */ }
      }
      try {
        (entry.popup as { addTo: (m: unknown) => void }).addTo(map);
        activePopupRef.current = entry.popup;
      } catch { /* noop */ }
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
