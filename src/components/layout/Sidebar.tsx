// src/components/layout/Sidebar.tsx
'use client';

import { useState } from 'react';
import {
  Plus, FileText, BarChart2, MapPin, TrendingUp, Settings,
  Truck, ChevronDown, ChevronUp, User
} from 'lucide-react';

export type NavItem = 'new-quotation' | 'quotations' | 'rate-management' | 'locations' | 'reports' | 'settings';

interface SidebarProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
}

const navItems: { id: NavItem; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'new-quotation', label: 'New Quotation', icon: Plus },
  { id: 'quotations', label: 'Quotations', icon: FileText },
  { id: 'rate-management', label: 'Rate Management', icon: BarChart2 },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeItem, onNavigate }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <aside
      style={{
        width: '220px',
        minWidth: '220px',
        height: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36,
            height: 36,
            backgroundColor: '#2563eb',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Truck size={20} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: '1.2' }}>UAE Freight</div>
            <div style={{ color: '#64748b', fontSize: 10, lineHeight: '1.2' }}>Pricing System</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                marginBottom: 2,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? 'white' : '#94a3b8',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                textAlign: 'left',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                }
              }}
            >
              <Icon size={16} className={isActive ? '' : ''} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User info */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 8px' }}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: '#1e3a5f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={15} color="#93c5fd" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin
            </div>
            <div style={{ color: '#64748b', fontSize: 10 }}>Pricing Executive</div>
          </div>
          {userMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </aside>
  );
}
