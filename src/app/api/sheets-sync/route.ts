// src/app/api/sheets-sync/route.ts
// Server-side proxy to fetch a shared Google Sheet as XLSX and parse all tabs into Rate[].

import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleSheetXlsxUrl, parseWorkbookToRates } from '@/lib/rates/sheets-sync';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const rawUrl = body?.url?.trim();

    if (!rawUrl) {
      return NextResponse.json(
        { error: 'Please paste a Google Sheet URL.' },
        { status: 400 },
      );
    }

    const xlsxUrl = buildGoogleSheetXlsxUrl(rawUrl);
    if (!xlsxUrl) {
      return NextResponse.json(
        { error: 'Invalid Google Sheet URL. Expected a docs.google.com/spreadsheets/d/... link.' },
        { status: 400 },
      );
    }

    const res = await fetch(xlsxUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'UAE-Freight-Pricing-Sync/1.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.status === 401 || res.status === 403
              ? 'Google Sheet is private. In Google Sheets, click Share → "Anyone with the link" (Viewer).'
              : `Failed to fetch Google Sheet (HTTP ${res.status}).`,
        },
        { status: 400 },
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        {
          error:
            'Google returned a login page instead of the sheet. Make sure Share is set to "Anyone with the link" (Viewer).',
        },
        { status: 400 },
      );
    }

    const buffer = await res.arrayBuffer();
    const { rates, tabCount, skippedRows } = parseWorkbookToRates(buffer, 'Google Sheets');

    if (rates.length === 0) {
      return NextResponse.json(
        {
          error:
            'Connected to Google Sheet, but 0 valid rates were found. Make sure your sheet has "Charge Name" and "Amount (AED)" columns with numbers > 0.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      rates,
      count: rates.length,
      tabCount,
      skippedRows,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
