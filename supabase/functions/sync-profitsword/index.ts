// SOUL — ProfitSword (Actabl) Sync Edge Function
// Fetches monthly P&L data from ProfitSword and upserts into the financials table.
//
// Deploy: supabase functions deploy sync-profitsword
// Invoke:  supabase.functions.invoke('sync-profitsword', { body: { from_month: 1, from_year: 2026 } })
//
// SETUP: Contact Actabl support to enable API access on your ProfitSword account.
// They will provide your API base URL and key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: logRow } = await supabase
    .from('sync_logs')
    .insert({ platform: 'profitsword', status: 'running' })
    .select()
    .single()
  const logId = logRow?.id

  const finish = async (status: string, message: string, rows = 0) => {
    await supabase.from('sync_logs').update({ status, message, rows_synced: rows, completed_at: new Date().toISOString() }).eq('id', logId)
    await supabase.from('integrations').update({ last_sync_at: new Date().toISOString(), last_sync_status: status, last_sync_message: message }).eq('platform', 'profitsword')
    return json({ status, message, rows_synced: rows })
  }

  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('platform', 'profitsword')
      .single()

    if (!integration?.enabled) return finish('error', 'ProfitSword integration is not enabled')

    const { api_url, api_key } = integration.credentials ?? {}
    const { property_ids } = integration.config ?? {}

    if (!api_url || !api_key) return finish('error', 'Missing ProfitSword api_url or api_key')
    if (!property_ids) return finish('error', 'No ProfitSword property IDs configured')

    const body = await req.json().catch(() => ({}))
    const fromYear  = body.from_year  ?? new Date().getFullYear()
    const fromMonth = body.from_month ?? 1

    const ids = String(property_ids).split(',').map((s: string) => s.trim())

    // ── Fetch P&L data from ProfitSword ──────────────────────────────────────
    // NOTE: ProfitSword does not publish a public API spec. The endpoint path
    // and request format must be confirmed with your Actabl account rep.
    //
    // Common patterns (update once you have your API documentation):
    //   GET  {api_url}/financials?propertyId={id}&year={y}&month={m}
    //   POST {api_url}/reports/pl  with body: { propertyIds, startDate, endDate }
    //
    // The example below shows a plausible GET pattern — adjust as needed.

    const { data: assets } = await supabase.from('assets').select('id, name')
    const assetMap: Record<string, string> = {}
    const mapConfig = integration.config?.asset_map ?? {}
    for (const a of assets ?? []) {
      if (mapConfig[a.id]) assetMap[mapConfig[a.id]] = a.id
    }

    const rows: unknown[] = []

    for (const propId of ids) {
      const dataRes = await fetch(
        `${api_url.replace(/\/$/, '')}/financials?propertyId=${propId}&year=${fromYear}&month=${fromMonth}`,
        {
          headers: {
            Authorization: `Bearer ${api_key}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!dataRes.ok) {
        console.warn(`ProfitSword property ${propId} returned ${dataRes.status}`)
        continue
      }
      const data = await dataRes.json()

      // Normalize to array (ProfitSword may return object or array)
      const records = Array.isArray(data) ? data : data.data ?? data.results ?? [data]

      for (const r of records) {
        const assetId = assetMap[propId] ?? assetMap[r.propertyId] ?? assetMap[r.property_id]
        if (!assetId) continue

        // Map ProfitSword field names → SOUL financials schema.
        // Adjust the field names (r.totalRevenue, r.grossOperatingProfit, etc.)
        // to match what ProfitSword actually returns for your account.
        rows.push({
          asset_id:      assetId,
          period_month:  r.month  ?? r.period_month  ?? fromMonth,
          period_year:   r.year   ?? r.period_year   ?? fromYear,
          revenue:       r.totalRevenue    ?? r.revenue    ?? null,
          gop:           r.grossOperatingProfit ?? r.gop  ?? null,
          noi:           r.netOperatingIncome  ?? r.noi   ?? null,
          ebitda:        r.ebitda ?? null,
          rooms_available: r.roomsAvailable ?? r.rooms_available ?? null,
          rooms_sold:    r.roomsSold    ?? r.rooms_sold    ?? null,
          occupancy:     r.occupancy    ?? null,
          adr:           r.adr          ?? r.averageDailyRate ?? null,
          revpar:        r.revpar       ?? r.revPAR ?? null,
          budget_revenue: r.budgetRevenue ?? r.budget_revenue ?? null,
          budget_noi:    r.budgetNOI    ?? r.budget_noi    ?? null,
        })
      }
    }

    if (rows.length === 0) return finish('success', 'No records returned from ProfitSword', 0)

    const { error: upsertErr } = await supabase
      .from('financials')
      .upsert(rows, { onConflict: 'asset_id,period_month,period_year' })

    if (upsertErr) return finish('error', `Upsert failed: ${upsertErr.message}`)

    return finish('success', `Synced ${rows.length} financial record(s) from ProfitSword`, rows.length)

  } catch (err) {
    return finish('error', err instanceof Error ? err.message : String(err))
  }
})
