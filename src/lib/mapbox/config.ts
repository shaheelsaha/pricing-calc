// src/lib/mapbox/config.ts
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  map: 'mapbox://styles/mapbox/light-v11',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
