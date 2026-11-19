// src/lib/pricing/engine.ts
// Deterministic pricing engine — no AI, no guessing

import Decimal from 'decimal.js';
import { Rate, QuotationItem, Location, TransportMode, ContainerType, VehicleType, ChargeCategory, MarkerColor } from '@/types';

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export interface PricingInput {
  mode: TransportMode;
  originLocationId: string;
  destinationLocationId: string;
  containerType?: ContainerType;
  vehicleType?: VehicleType;
  quantity?: number;
  externalFreightAmount?: number;
  externalFreightCarrier?: string;
}

export interface PricingResult {
  items: QuotationItem[];
  totalBuyingCost: number;
  missingRates: string[];
  warnings: string[];
}

function isRateValid(rate: Rate): boolean {
  const now = new Date().toISOString().slice(0, 10);
  return (
    rate.active &&
    rate.validFrom <= now &&
    rate.validUntil >= now
  );
}

function matchesRoute(rate: Rate, input: PricingInput): boolean {
  const originMatch = !rate.originLocationId || rate.originLocationId === input.originLocationId;
  const destMatch = !rate.destinationLocationId || rate.destinationLocationId === input.destinationLocationId;
  return originMatch && destMatch;
}

function matchesVehicle(rate: Rate, input: PricingInput): boolean {
  if (!rate.containerType && !rate.vehicleType) return true;
  if (rate.containerType && rate.containerType !== input.containerType) return false;
  if (rate.vehicleType && rate.vehicleType !== input.vehicleType) return false;
  return true;
}

export function markerColorForCategory(category: ChargeCategory): MarkerColor {
  switch (category) {
    case 'terminal':
    case 'port':
    case 'handling':
      return 'orange';
    case 'toll':
      return 'purple';
    case 'trucking':
      return 'blue';
    case 'delivery':
      return 'red';
    default:
      return 'orange';
  }
}

export function calculatePricing(
  rates: Rate[],
  locations: Location[],
  input: PricingInput,
): PricingResult {
  const items: QuotationItem[] = [];
  const warnings: string[] = [];
  const missingRates: string[] = [];
  const usedCategories = new Set<string>();

  // Filter applicable rates
  const applicable = rates.filter(
    (r) =>
      r.mode === input.mode &&
      isRateValid(r) &&
      matchesRoute(r, input) &&
      matchesVehicle(r, input)
  );

  for (const rate of applicable) {
    // Prevent duplicate charge categories unless it's explicitly a different route
    const dedupKey = `${rate.chargeCategory}-${rate.originLocationId || ''}-${rate.destinationLocationId || ''}`;
    if (usedCategories.has(dedupKey)) {
      warnings.push(`Duplicate rate skipped: ${rate.chargeName}`);
      continue;
    }
    usedCategories.add(dedupKey);

    const qty = input.quantity ?? 1;
    const total = new Decimal(rate.amount).times(qty).toNumber();
    const location = locations.find(
      (l) => l.locationId === (rate.originLocationId || input.originLocationId)
    );

    items.push({
      id: rate.rateId,
      chargeName: rate.chargeName,
      chargeCategory: rate.chargeCategory,
      amount: rate.amount,
      currency: rate.currency,
      unit: rate.unit,
      quantity: qty,
      total,
      rateId: rate.rateId,
      locationId: location?.locationId,
      locationName: location?.name,
      markerColor: markerColorForCategory(rate.chargeCategory),
      source: 'rate_master',
    });
  }

  // Add external freight if provided
  if (input.externalFreightAmount && input.externalFreightAmount > 0) {
    items.push({
      id: 'external-freight',
      chargeName: `Ocean Freight${input.externalFreightCarrier ? ` (${input.externalFreightCarrier})` : ''}`,
      chargeCategory: 'other',
      amount: input.externalFreightAmount,
      currency: 'AED',
      unit: 'per_shipment',
      quantity: 1,
      total: input.externalFreightAmount,
      markerColor: 'blue',
      isExternalFreight: true,
      source: 'external',
    });
  }

  const totalBuyingCost = items.reduce(
    (sum, item) => new Decimal(sum).plus(item.total).toNumber(),
    0
  );

  return { items, totalBuyingCost, missingRates, warnings };
}

export function applyMarkup(
  totalCost: number,
  markup: number,
  markupType: 'percentage' | 'fixed',
): { sellingPrice: number; margin: number } {
  const cost = new Decimal(totalCost);
  let sellingPrice: Decimal;

  if (markupType === 'percentage') {
    sellingPrice = cost.times(new Decimal(1).plus(new Decimal(markup).div(100)));
  } else {
    sellingPrice = cost.plus(markup);
  }

  const marginAmount = sellingPrice.minus(cost);
  const marginPct = cost.isZero()
    ? new Decimal(0)
    : marginAmount.div(sellingPrice).times(100);

  return {
    sellingPrice: sellingPrice.toDecimalPlaces(2).toNumber(),
    margin: marginPct.toDecimalPlaces(2).toNumber(),
  };
}
