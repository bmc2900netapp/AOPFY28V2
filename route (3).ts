export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/people/search?q=<query>
 *
 * Searches Azure AD / Microsoft 365 for people matching the query string.
 * Uses the viewer connector token (SHAREPOINT / Graph) to call the Graph
 * /users endpoint. Returns up to 10 matches with displayName and mail.
 *
 * Falls back gracefully: if the viewer hasn't connected SharePoint or the
 * call fails, returns an empty array (the UI still allows manual email entry).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const viewerApiKey = request.headers.get('x-abacus-user-api-key');
  if (!viewerApiKey) {
    // Running on raw localhost (no Abacus proxy) — return empty.
    return NextResponse.json({ results: [] });
  }

  try {
    // Get an access token for SharePoint / Graph.
    const tokenRes = await fetch('https://api.abacus.ai/api/_getViewerConnectorToken', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerApiKey}`,
      },
      body: JSON.stringify({ service: 'SHAREPOINT' }),
    });

    if (!tokenRes.ok) {
      // Viewer hasn't connected SharePoint — graceful empty.
      return NextResponse.json({ results: [] });
    }

    const { result: { access_token } } = await tokenRes.json();

    // Search users via Graph. Use $search on displayName (requires
    // ConsistencyLevel: eventual header) for substring matching.
    const safeQ = q.replace(/'/g, "''");
    const graphUrl =
      `https://graph.microsoft.com/v1.0/users?$filter=` +
      `startswith(displayName,'${encodeURIComponent(safeQ)}') or startswith(mail,'${encodeURIComponent(safeQ)}')` +
      `&$select=displayName,mail,userPrincipalName&$top=10`;

    const graphRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!graphRes.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await graphRes.json();
    const results = (data.value ?? []).map((u: any) => ({
      name: u.displayName ?? '',
      email: u.mail ?? u.userPrincipalName ?? '',
    })).filter((u: any) => u.email);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
