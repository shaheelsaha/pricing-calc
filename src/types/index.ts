// src/types/index.ts
// Central type definitions for the UAE Freight Pricing System

export type TransportMode = 'land' | 'sea' | 'air';
export type ContainerType = '20ft' | '40ft' | '40ft_hc' | 'reefer' | 'lcl' | 'other';
export type VehicleType = 'pickup' | '3ton' | '7ton' | '10ton' | '20ton' | 'trailer' | 'lowbed';
export type ChargeCategory = 'terminal' | 'port' | 'customs' | 'gate_pass' | 'trucking' | 'toll' | 'delivery' | 'storage' | 'documentation' | 'handling' | 'other';
export type PricingBasis = 'per_shipment' | 'per_container' | 'per_vehicle' | 'per_kg' | 'per_chargeable_kg' | 'per_tonne' | 'per_trip' | 'per_hour' | 'per_day' | 'fixed';
export type LocationType = 'port' | 'airport' | 'free_zone' | 'industrial' | 'city' | 'warehouse' | 'custom';
export type MarkerColor = 'green' | 'orange' | 'purple' | 'blue' | 'red';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Location {
  locationId: string;
  name: string;
  locationType: LocationType;
  emirate: string;
  latitude: number;
  longitude: number;
  address?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Rate {
  rateId: string;
  chargeName: string;
  chargeCategory: ChargeCategory;
  mode: TransportMode;
  originLocationId?: string;
  destinationLocationId?: string;
  amount: number;
  currency: string;
  unit: PricingBasis;
  vehicleType?: VehicleType;
  containerType?: ContainerType;
  validFrom: string;
  validUntil: string;
  active: boolean;
  source: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteRate {
  routeId: string;
  originLocationId: string;
  destinationLocationId: string;
  mode: TransportMode;
  vehicleType?: VehicleType;
  containerType?: ContainerType;
  amount: number;
  currency: string;
  active: boolean;
  validFrom: string;
  validUntil: string;
}

export interface QuotationItem {
  id: string;
  chargeName: string;
  chargeCategory: ChargeCategory;
  amount: number;
  currency: string;
  unit: PricingBasis;
  quantity: number;
  total: number;
  rateId?: string;
  locationId?: string;
  locationName?: string;
  markerColor?: MarkerColor;
  isManual?: boolean;
  isOverride?: boolean;
  overrideNote?: string;
  isExternalFreight?: boolean;
  source: 'rate_master' | 'manual' | 'external' | 'route_rate';
}

export interface ShipmentDetails {
  mode: TransportMode;
  containerType?: ContainerType;
  vehicleType?: VehicleType;
  quantity?: number;
  grossWeight?: number;
  chargeableWeight?: number;
  packageCount?: number;
  cargoType?: string;
}

export interface Quotation {
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  customerContact?: string;
  customerEmail?: string;
  originLocationId: string;
  originLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  mode: TransportMode;
  shipmentDetails: ShipmentDetails;
  externalFreightAmount?: number;
  externalFreightCurrency?: string;
  externalFreightCarrier?: string;
  localCharges: QuotationItem[];
  totalBuyingCost: number;
  markup: number;
  markupType: 'percentage' | 'fixed';
  sellingPrice: number;
  margin: number;
  currency: string;
  status: QuotationStatus;
  validityDays: number;
  notes?: string;
  internalNotes?: string;
  routeDistance?: number;
  routeTransitTime?: number;
  rateSnapshot: Rate[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface MapMarker {
  id: string;
  locationId?: string;
  locationName: string;
  longitude: number;
  latitude: number;
  color: MarkerColor;
  chargeItems: QuotationItem[];
  isOrigin?: boolean;
  isDestination?: boolean;
  routeDistanceKm?: number; // position along route (for animation ordering)
}

export interface RouteInfo {
  distance: number; // km
  duration: number; // minutes
  geometry: GeoJSON.LineString;
  waypoints: [number, number][];
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'pricing_executive' | 'viewer';
  company?: string;
}
