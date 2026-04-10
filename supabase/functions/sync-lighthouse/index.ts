// SOUL — Lighthouse Sync Edge Function
// Fetches rate intelligence and benchmarking data from Lighthouse (formerly OTA Insight)
// and upserts into comp_data.
//
// Deploy: supabase functions deploy sync-lighthouse
// Invoke:  supabase.functions.invoke('sync-lighthouse', { body: { from_month: 1, from_year: 2026 } })
//
// SETUP: Apply to the Lighthouse Developer Solutions Suite at mylighthouse.com.
// The partner certification program provides API credentials and docs.

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
    .insert({ platform: 'lighthouse', status: 'running' })
    .select()
    .single()
  const logId = logRow?.id

  const finish = async (status: string, message: string, rows = 0) => {
    await supabase.from('sync_logs').update({ status, message, rows_synced: rows, completed_at: new Date().toISOString() }).eq('id', logId)
    await supabase.from('integrations').update({ last_sync_at: new Date().toISOString(), last_sync_status: status, last_sync_message: message }).eq('platform', 'lighthouse')
    return json({ status, message, rows_synced: rows })
  }

  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('platform', 'lighthouse')
      .single()

    if (!integration?.enabled) return finish('error', 'Lighthouse integration is not enabled')

    const { api_key } = integration.credentials ?? {}
    const { hotel_ids } = integration.config ?? {}

    if (!api_key) return finish('error', 'Missing Lighthouse API key')
    if (!hotel_ids) return finish('error', 'No Lighthouse hotel IDs configured')

    const body = await req.json().catch(() => ({}))
    const fromYear  = body.from_year  ?? new Date().getFullYear()
    const fromMonth = body.from_month ?? 1

    const ids = String(hotel_ids).split(',').map((s: string) => s.trim())

    const { data: assets } = await supabase.from('assets').select('id, name')
    const assetMap: Record<string, string> = {}
    const mapConfig = integration.config?.asset_map ?? {}
    for (const a of assets ?? []) {
      if (mapConfig[a.id]) assetMap[mapConfig[a.id]] = a.id
    }

    // ── Fetch Lighthouse data ─────────────────────────────────────────────────
    // NOTE: The Lighthouse Integration API launched in Feb 2025. Full endpoint
    // documentation is provided after partner certification.
    //
    // Known base URL pattern: https://api.mylighthouse.com/v1/
    // Known auth: Authorization: Bearer {api_key}
    //
    // Lighthouse modules available via API:
    //   - Business Intelligence:   /v1/business-intelligence/properties/{id}/metrics
    //   - Benchmark Insight:       /v1/benchmark/properties/{id}/data
    //   - Pricing Manager:         /v1/pricing/properties/{id}/rates
    //
    // The example below uses the Benchmark Insight module. Update path once you
    // have your partner documentation.

    const rows: unknown[] = []

    for (const hotelId of ids) {
      const dataRes = await fetch(
        `https://api.mylighthouse.com/v1/benchmark/properties/${hotelId}/data?year=${fromYear}&month=${fromMonth}`,
        { headers: { Authorization: `Bearer ${api_key}` } }
      )
      if (!dataRes.ok) {
        console.warn(`Lighthouse hotel ${hotelId} returned ${dataRes.status}`)
        continue
      }
      const data = await dataRes.json()
      const records = Array.isArray(data) ? data : data.data ?? data.results ?? [data]

      for (const r of records) {
        const assetId = assetMap[hotelId] ?? assetMap[r.hotelId] ?? assetMap[r.hotel_id]
        if (!assetId) continue

        // Map Lighthouse fields → SOUL comp_data schema.
        // Adjust field names to match what the Benchmark Insight API actually returns.
        rows.push({
          asset_id:        assetId,
          period_month:    r.month ?? r.period_month ?? fromMonth,
          period_year:     r.year  ?? r.period_year  ?? fromYear,
          my_occupancy:    r.myOccupancy   ?? r.my_occupancy   ?? null,
          my_adr:          r.myADR         ?? r.my_adr         ?? null,
          my_revpar:       r.myRevPAR      ?? r.my_revpar      ?? null,
          comp_set_occ:    r.compSetOcc    ?? r.comp_set_occ   ?? null,
          comp_set_adr:    r.compSetADR    ?? r.comp_set_adr   ?? null,
          comp_set_revpar: r.compSetRevPAR ?? r.comp_set_revpar ?? null,
          occ_index:       r.mpi           ?? r.occ_index      ?? null,
          adr_index:       r.ari           ?? r.adr_index      ?? null,
          revpar_index:    r.rgi           ?? r.revpar_index   ?? null,
        })
      }
    }

    if (rows.length === 0) return finish('success', 'No records returned from Lighthouse', 0)

    const { error: upsertErr } = await supabase
      .from('comp_data')
      .upsert(rows, { onConflict: 'asset_id,period_month,period_year' })

    if (upsertErr) return finish('error', `Upsert failed: ${upsertErr.message}`)

    return finish('success', `Synced ${rows.length} rate record(s) from Lighthouse`, rows.length)

  } catch (err) {
    return finish('error', err instanceof Error ? err.message : String(err))
  }
})
