# UAE Freight Pricing Intelligence System

An internal freight pricing application for UAE-based shipping and logistics operations.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp .env.example .env.local
```

Required variables:
| Variable | Description | Source |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public access token | [mapbox.com/account](https://account.mapbox.com/access-tokens/) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Firebase Console → Project Settings |

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
├── components/
│   ├── layout/           # Sidebar, navigation
│   ├── dashboard/        # TopBar, transport mode controls
│   ├── map/              # FreightMap (Mapbox GL JS)
│   └── pricing/          # QuotationPanel, cost breakdown
├── lib/
│   ├── firebase/         # Firestore config & queries
│   ├── mapbox/           # Map config, Directions API
│   └── pricing/          # Pricing engine, demo rates
├── types/                # TypeScript interfaces
└── constants/            # UAE locations, container types
```

## Features (Phase 1 — Foundation)

- ✅ UAE Mapbox satellite map, centered on Dubai/Jebel Ali
- ✅ Land / Sea / Air freight mode selection
- ✅ From → To location selectors (21 UAE locations)
- ✅ Container / vehicle type selector
- ✅ Route calculation via Mapbox Directions API
- ✅ Color-coded cost markers (Green=Origin, Orange=Terminal, Purple=Toll, Red=Destination)
- ✅ Clickable markers with popup cost details
- ✅ Map ↔ quotation panel synchronization (click to highlight)
- ✅ Cost breakdown with totals
- ✅ Markup / margin calculation
- ✅ Map style switching (Satellite / Streets / Map)
- ✅ Demo rates for Jebel Ali → Sharjah (land, 40ft container)

## Upcoming Phases

- **Phase 2**: Full Firebase integration, persistent locations & rates
- **Phase 3**: Excel rate master import
- **Phase 4**: Complete pricing engine with all charge types
- **Phase 5**: PDF quotation generation (internal + customer)
- **Phase 6**: Testing & deployment

## Technology Stack

- **Framework**: Next.js 16 + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4
- **Map**: Mapbox GL JS 3 (satellite imagery)
- **Database**: Firebase Firestore (Spark / free tier)
- **Auth**: Firebase Authentication
- **Excel**: SheetJS (xlsx)
- **PDF**: jsPDF
- **Geo**: Turf.js
- **Finance**: Decimal.js (no floating-point errors)

## Security Notes

- Never commit `.env.local`
- Restrict your Mapbox token to approved domains in production
- Firestore security rules: see `firestore.rules`
- Internal buying costs are never exposed in customer PDFs
