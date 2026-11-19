// src/components/dashboard/TopBar.tsx
'use client';

import { ArrowLeftRight, Calculator, Ship, Plane, Truck } from 'lucide-react';
import { TransportMode, ContainerType, VehicleType } from '@/types';
import { UAE_LOCATIONS, CONTAINER_TYPES, VEHICLE_TYPES } from '@/constants/locations';

interface TopBarProps {
  mode: TransportMode;
  onModeChange: (m: TransportMode) => void;
  originId: string;
  destinationId: string;
  onOriginChange: (id: string) => void;
  onDestinationChange: (id: string) => void;
  containerType: ContainerType;
  vehicleType: VehicleType;
  onContainerTypeChange: (c: ContainerType) => void;
  onVehicleTypeChange: (v: VehicleType) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

const MODES: { id: TransportMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'land', label: 'Land (Trucking)', icon: Truck },
  { id: 'sea', label: 'Sea Freight', icon: Ship },
  { id: 'air', label: 'Air Freight', icon: Plane },
];

export default function TopBar({
  mode, onModeChange,
  originId, destinationId,
  onOriginChange, onDestinationChange,
  containerType, vehicleType,
  onContainerTypeChange, onVehicleTypeChange,
  onCalculate, isCalculating,
}: TopBarProps) {

  const activeLocations = UAE_LOCATIONS.filter(l => l.active);

  const handleSwap = () => {
    const tmp = originId;
    onOriginChange(destinationId);
    onDestinationChange(tmp);
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: 'white',
    color: '#1e293b',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 16px',
      flexShrink: 0,
    }}>
      {/* Mode Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 0 8px' }}>
        {MODES.map(({ id, label, icon: Icon }) => {
          const isActive = mode === id;
          return (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: isActive ? '2px solid #2563eb' : '2px solid #e2e8f0',
                borderRadius: 6,
                cursor: 'pointer',
                backgroundColor: isActive ? '#eff6ff' : 'white',
                color: isActive ? '#2563eb' : '#64748b',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Controls Row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        paddingBottom: 10,
        flexWrap: 'wrap',
      }}>
        {/* From */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>From</label>
          <select
            value={originId}
            onChange={(e) => onOriginChange(e.target.value)}
            style={{ ...selectStyle, minWidth: 200 }}
          >
            <option value="">Select origin…</option>
            {activeLocations.map(l => (
              <option key={l.locationId} value={l.locationId}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Swap */}
        <button
          onClick={handleSwap}
          style={{
            width: 32,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            backgroundColor: 'white',
            cursor: 'pointer',
            flexShrink: 0,
            color: '#64748b',
          }}
          title="Swap origin and destination"
        >
          <ArrowLeftRight size={14} />
        </button>

        {/* To */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>To</label>
          <select
            value={destinationId}
            onChange={(e) => onDestinationChange(e.target.value)}
            style={{ ...selectStyle, minWidth: 200 }}
          >
            <option value="">Select destination…</option>
            {activeLocations.map(l => (
              <option key={l.locationId} value={l.locationId}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Container / Vehicle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
            {mode === 'land' ? 'Vehicle Type' : mode === 'sea' ? 'Container Type' : 'Cargo Type'}
          </label>
          {mode === 'sea' ? (
            <select
              value={containerType}
              onChange={(e) => onContainerTypeChange(e.target.value as ContainerType)}
              style={{ ...selectStyle, minWidth: 160 }}
            >
              {CONTAINER_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          ) : mode === 'land' ? (
            <select
              value={vehicleType}
              onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType)}
              style={{ ...selectStyle, minWidth: 160 }}
            >
              {VEHICLE_TYPES.map(vt => (
                <option key={vt.value} value={vt.value}>{vt.label}</option>
              ))}
            </select>
          ) : (
            <select style={{ ...selectStyle, minWidth: 160 }}>
              <option>General Cargo</option>
              <option>Dangerous Goods</option>
              <option>Perishables</option>
              <option>Oversized</option>
            </select>
          )}
        </div>

        {/* Calculate */}
        <button
          onClick={onCalculate}
          disabled={!originId || !destinationId || isCalculating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 18px',
            height: 36,
            backgroundColor: (!originId || !destinationId || isCalculating) ? '#93c5fd' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: (!originId || !destinationId || isCalculating) ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <Calculator size={15} />
          {isCalculating ? 'Calculating…' : 'Calculate'}
        </button>
      </div>
    </div>
  );
}
