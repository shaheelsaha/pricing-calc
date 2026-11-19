// src/components/pricing/QuotationPanel.tsx
'use client';

import { useState } from 'react';
import {
  FileDown, Save, ChevronDown, ChevronUp,
  Package, Truck, Anchor, Plane, AlertTriangle,
} from 'lucide-react';
import {
  QuotationItem, RouteInfo, TransportMode,
  ContainerType, VehicleType, Location,
} from '@/types';
import { CONTAINER_TYPES, VEHICLE_TYPES } from '@/constants/locations';

const CATEGORY_ICONS: Record<string, string> = {
  terminal: '🏭', port: '⚓', customs: '📋', gate_pass: '🚧',
  trucking: '🚛', toll: '🛣️', delivery: '📦', storage: '🏢',
  documentation: '📄', handling: '🏗️', other: '💼',
};

const CATEGORY_COLORS: Record<string, string> = {
  terminal: '#ea580c', port: '#ea580c', customs: '#7c3aed',
  gate_pass: '#d97706', trucking: '#2563eb', toll: '#9333ea',
  delivery: '#dc2626', storage: '#0891b2', other: '#64748b',
};

interface QuotationPanelProps {
  mode: TransportMode;
  originLocation: Location | null;
  destinationLocation: Location | null;
  containerType: ContainerType;
  vehicleType: VehicleType;
  route: RouteInfo | null;
  items: QuotationItem[];          // revealed so far
  allItemsCount: number;           // total expected
  externalFreight: number;
  externalCarrier: string;
  onExternalFreightChange: (v: number) => void;
  onExternalCarrierChange: (v: string) => void;
  markup: number;
  markupType: 'percentage' | 'fixed';
  onMarkupChange: (v: number) => void;
  onMarkupTypeChange: (t: 'percentage' | 'fixed') => void;
  totalCost: number;
  sellingPrice: number;
  margin: number;
  highlightedItemId: string | null;
  onItemClick: (id: string) => void;
  onSave: () => void;
  onExportPDF: () => void;
  warnings: string[];
  hasCalculated: boolean;
  isAnimating?: boolean;
  animComplete?: boolean;
}

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationPanel({
  mode, originLocation, destinationLocation,
  containerType, vehicleType, route, items,
  allItemsCount,
  externalFreight, externalCarrier,
  onExternalFreightChange, onExternalCarrierChange,
  markup, markupType, onMarkupChange, onMarkupTypeChange,
  totalCost, sellingPrice, margin,
  highlightedItemId, onItemClick,
  onSave, onExportPDF,
  warnings, hasCalculated,
  isAnimating = false,
  animComplete = false,
}: QuotationPanelProps) {
  const [externalOpen, setExternalOpen] = useState(true);

  const containerLabel = CONTAINER_TYPES.find(c => c.value === containerType)?.label || containerType;
  const vehicleLabel   = VEHICLE_TYPES.find(v => v.value === vehicleType)?.label || vehicleType;
  const shipmentLabel  = mode === 'sea' ? containerLabel : mode === 'land' ? vehicleLabel : 'Air Cargo';
  const ModeIcon       = mode === 'sea' ? Anchor : mode === 'air' ? Plane : Truck;

  const allLoaded = !isAnimating || animComplete;

  return (
    <div style={{
      width: 320, minWidth: 300, maxWidth: 340, height: '100%',
      backgroundColor: 'white', borderLeft: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, backgroundColor: '#eff6ff', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ModeIcon size={15} color="#2563eb" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Quotation Summary</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* Route meta */}
        <div style={{ marginBottom: 14 }}>
          {[
            { label: 'Route',
              value: originLocation && destinationLocation
                ? `${originLocation.name} → ${destinationLocation.name}` : '—' },
            { label: 'Distance',     value: route ? `≈ ${route.distance} km`  : '—' },
            { label: 'Transit Time', value: route ? `≈ ${route.duration} min` : '—' },
            { label: mode === 'sea' ? 'Container' : mode === 'land' ? 'Vehicle' : 'Cargo',
              value: shipmentLabel },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0', fontSize: 12,
            }}>
              <span style={{ color: '#64748b' }}>{label}</span>
              <span style={{ color: '#1e293b', fontWeight: 500, textAlign: 'right', maxWidth: '55%', fontSize: 11 }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{
            backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: 6, padding: '8px 10px', marginBottom: 12,
          }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: '#9a3412' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Cost breakdown */}
        {hasCalculated && (
          <>
            {/* Section header with animated progress */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                Cost Breakdown (AED)
              </span>
              {isAnimating && allItemsCount > 0 && (
                <span style={{
                  fontSize: 10, color: '#2563eb', fontWeight: 600,
                  backgroundColor: '#eff6ff', padding: '2px 7px', borderRadius: 10,
                }}>
                  {items.length} / {allItemsCount}
                </span>
              )}
            </div>

            {/* Animated progress bar */}
            {isAnimating && allItemsCount > 0 && (
              <div style={{
                height: 3, backgroundColor: '#e2e8f0', borderRadius: 2,
                marginBottom: 10, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (items.length / allItemsCount) * 100)}%`,
                  backgroundColor: '#2563eb', borderRadius: 2,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            )}

            {items.length === 0 && !isAnimating ? (
              <div style={{
                textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12,
              }}>
                No rates found for this route.<br />
                <span style={{ fontSize: 11 }}>Import rates in Rate Management.</span>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {items.map((item, idx) => {
                  const isHighlighted = item.id === highlightedItemId;
                  const accentColor = CATEGORY_COLORS[item.chargeCategory] || '#64748b';
                  const isLatest = idx === items.length - 1 && isAnimating;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onItemClick(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 8px', marginBottom: 3, borderRadius: 7,
                        cursor: 'pointer',
                        backgroundColor: isHighlighted
                          ? '#eff6ff'
                          : isLatest ? '#fafafa' : 'transparent',
                        border: isHighlighted
                          ? '1px solid #bfdbfe'
                          : isLatest ? '1px solid #e2e8f0' : '1px solid transparent',
                        borderLeft: `3px solid ${isHighlighted ? accentColor : isLatest ? accentColor : 'transparent'}`,
                        transition: 'all 0.2s ease',
                        // Slide-in animation for each row
                        animation: 'slideInRow 0.35s ease both',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ fontSize: 15, flexShrink: 0 }}>
                          {CATEGORY_ICONS[item.chargeCategory] || '💼'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, color: '#1e293b',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: 160,
                          }}>
                            {item.chargeName}
                          </div>
                          {item.isExternalFreight && (
                            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>
                              External
                            </div>
                          )}
                          {item.locationName && !item.isExternalFreight && (
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                              📍 {item.locationName}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                          {item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {item.unit.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Remaining placeholders while animating */}
                {isAnimating && items.length < allItemsCount && (
                  Array.from({ length: Math.min(2, allItemsCount - items.length) }).map((_, i) => (
                    <div key={`ph-${i}`} style={{
                      height: 46, marginBottom: 3, borderRadius: 7,
                      backgroundColor: '#f8fafc', border: '1px solid #f1f5f9',
                      display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
                      opacity: 0.4 - i * 0.15,
                    }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#e2e8f0' }} />
                      <div style={{ flex: 1, height: 10, borderRadius: 4, backgroundColor: '#e2e8f0' }} />
                      <div style={{ width: 50, height: 10, borderRadius: 4, backgroundColor: '#e2e8f0' }} />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* External freight (Sea / Air) */}
            {(mode === 'sea' || mode === 'air') && allLoaded && (
              <div style={{
                border: '1px solid #e2e8f0', borderRadius: 8,
                marginBottom: 12, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setExternalOpen(!externalOpen)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '8px 10px', border: 'none',
                    backgroundColor: '#f8fafc', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: '#1e293b',
                  }}
                >
                  {mode === 'sea' ? '🚢 Ocean Freight' : '✈️ Air Freight'} (External)
                  {externalOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {externalOpen && (
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>
                        Carrier / Shipping Line
                      </label>
                      <input
                        value={externalCarrier}
                        onChange={e => onExternalCarrierChange(e.target.value)}
                        placeholder="e.g. Maersk, MSC, Emirates…"
                        style={{
                          width: '100%', height: 32, padding: '0 8px',
                          border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>
                        Freight Rate (AED)
                      </label>
                      <input
                        type="number" min={0} value={externalFreight || ''}
                        onChange={e => onExternalFreightChange(Number(e.target.value))}
                        placeholder="Enter freight amount…"
                        style={{
                          width: '100%', height: 32, padding: '0 8px',
                          border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totals — only show when animation is complete */}
            {allLoaded && (
              <div style={{
                borderTop: '2px solid #e2e8f0', paddingTop: 10, marginBottom: 10,
                animation: 'slideInRow 0.4s ease both',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Total Cost</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>
                    {fmt(totalCost)}
                  </span>
                </div>

                {/* Markup row */}
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 8,
                  alignItems: 'center', padding: '6px 8px',
                  backgroundColor: '#f8fafc', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>Margin</span>
                  <input
                    type="number" min={0}
                    max={markupType === 'percentage' ? 100 : undefined}
                    value={markup}
                    onChange={e => onMarkupChange(Number(e.target.value))}
                    style={{
                      width: 56, height: 26, padding: '0 6px',
                      border: '1px solid #e2e8f0', borderRadius: 4,
                      fontSize: 12, textAlign: 'right',
                    }}
                  />
                  <select
                    value={markupType}
                    onChange={e => onMarkupTypeChange(e.target.value as 'percentage' | 'fixed')}
                    style={{
                      height: 26, padding: '0 4px',
                      border: '1px solid #e2e8f0', borderRadius: 4,
                      fontSize: 11, backgroundColor: 'white',
                    }}
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">AED</option>
                  </select>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>
                    = {fmt(sellingPrice - totalCost)}
                  </span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', backgroundColor: '#f0fdf4',
                  borderRadius: 8, border: '1px solid #bbf7d0',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      Selling Price
                    </div>
                    <div style={{ fontSize: 10, color: '#16a34a' }}>
                      Margin {margin.toFixed(1)}%
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>
                    {fmt(sellingPrice)}
                  </span>
                </div>
              </div>
            )}

            {/* Still animating — show running total */}
            {isAnimating && !allLoaded && items.length > 0 && (
              <div style={{
                borderTop: '2px dashed #e2e8f0', paddingTop: 10, marginBottom: 10,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                    Running total…
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                    {fmt(totalCost)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!hasCalculated && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
            <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#64748b' }}>
              Ready to Calculate
            </div>
            <div style={{ fontSize: 11 }}>
              Select origin &amp; destination, then click <strong>Calculate</strong>.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
              The map will animate your full<br />shipment journey, charge by charge.
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid #e2e8f0',
        display: 'flex', gap: 8, flexShrink: 0, backgroundColor: 'white',
      }}>
        <button
          onClick={onExportPDF}
          disabled={!hasCalculated || isAnimating}
          style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, height: 36,
            border: '1px solid #e2e8f0', borderRadius: 6,
            backgroundColor: 'white', fontSize: 12, fontWeight: 500,
            cursor: (hasCalculated && !isAnimating) ? 'pointer' : 'not-allowed',
            color: (hasCalculated && !isAnimating) ? '#1e293b' : '#94a3b8',
          }}
        >
          <FileDown size={14} />
          Export PDF
        </button>
        <button
          onClick={onSave}
          disabled={!hasCalculated || isAnimating}
          style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, height: 36,
            border: 'none', borderRadius: 6,
            backgroundColor: (hasCalculated && !isAnimating) ? '#2563eb' : '#93c5fd',
            cursor: (hasCalculated && !isAnimating) ? 'pointer' : 'not-allowed',
            fontSize: 12, fontWeight: 600, color: 'white',
          }}
        >
          <Save size={14} />
          Save Quotation
        </button>
      </div>

      {/* CSS for row animation */}
      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
