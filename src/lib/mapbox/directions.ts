// src/lib/mapbox/directions.ts
// Mapbox Directions API client with route caching

import { MAPBOX_TOKEN } from './config';
import { RouteInfo } from '@/types';

const routeCache = new Map<string, RouteInfo>();

function cacheKey(
  origin: [number, number],
  destination: [number, number],
  excludeToll: boolean = true,
  waypoints: [number, number][] = [],
): string {
  const pts = [origin, ...waypoints, destination].map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';');
  return `${pts}${excludeToll ? ';no-toll' : ''}`;
}

export async function getRoute(
  origin: [number, number],       // [lng, lat]
  destination: [number, number],  // [lng, lat]
  excludeToll: boolean = true,    // Avoid E11 and Salik toll roads
  waypoints: [number, number][] = [],
): Promise<RouteInfo | null> {
  if (!MAPBOX_TOKEN) {
    console.warn('Mapbox token not configured');
    return null;
  }

  const key = cacheKey(origin, destination, excludeToll, waypoints);
  if (routeCache.has(key)) {
    return routeCache.get(key)!;
  }

  try {
    const excludeParam = excludeToll ? '&exclude=toll' : '';
    const coordsStr = [origin, ...waypoints, destination].map(p => `${p[0]},${p[1]}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full${excludeParam}&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Directions API error:', res.status);
      return null;
    }
    const data = await res.json();
    if (!data.routes?.length) return null;

    const route = data.routes[0];
    const info: RouteInfo = {
      distance: Math.round(route.distance / 100) / 10, // metres -> km (1dp)
      duration: Math.round(route.duration / 60),        // seconds -> minutes
      geometry: route.geometry as GeoJSON.LineString,
      waypoints: data.waypoints.map((w: { location: [number, number] }) => w.location),
    };

    routeCache.set(key, info);
    return info;
  } catch (err) {
    console.error('Failed to fetch route:', err);
    return null;
  }
}

export function clearRouteCache() {
  routeCache.clear();
}
