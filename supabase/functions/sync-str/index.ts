// SOUL — STR / CoStar Sync Edge Function
// Authenticates with STR OAuth, fetches competitive benchmarking data,
// and upserts into the comp_data table.
//
// Deploy: supabase functions deploy sync-str
// Invoke:  supabase.functions.invoke('sync-str', { body: { from_month: 1, from_year: 2026 } })

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

  // ── Log start ───────────────────────────────────────────────────────────────
  const { data: logRow } = await supabase
    .from('sync_logs')
    .insert({ platform: 'str', status: 'running' })
    .select()
    .single()
  const logId = logRow?.id

  const finish = async (status: string, message: string, rows = 0) => {
    await supabase.from('sync_logs').update({ status, message, rows_synced: rows, completed_at: new Date().toISOString() }).eq('id', logId)
    await supabase.from('integrations').update({ last_sync_at: new Date().toISOString(), last_sync_status: status, last_sync_message: message }).eq('platform', 'str')
    return json({ status, message, rows_synced: rows })
  }

  try {
    // ── Load credentials ─────────────────────────────────────────────────────
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('platform', 'str')
      .single()

    if (!integration?.enabled) return finish('error', 'STR integration is not enabled')

    const { client_id, client_secret } = integration.credentials ?? {}
    const { property_codes } = integration.config ?? {}

    if (!client_id || !client_secret) return finish('error', 'Missing STR client_id or client_secret')
    if (!property_codes) return finish('error', 'No STR property codes configured')

    // ── OAuth — Client Credentials ───────────────────────────────────────────
    const tokenRes = await fetch('https://identity.str.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id,
        client_secret,
        scope: 'datasubmission',   // adjust scope if your contract grants benchmarking read
      }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return finish('error', `STR auth failed (${tokenRes.status}): ${err}`)
    }
    const { access_token } = await tokenRes.json()

    // ── Fetch benchmarking data ───────────────────────────────────────────────
    // NOTE: The exact endpoint path depends on your STR contract / subscription tier.
    // Common patterns — confirm with your STR API rep:
    //   GET /v1/properties/{propertyCode}/benchmarking
    //   GET /v1/reports/benchmarking?propertyCodes=12345,67890&startDate=2026-01-01
    //
    // The example below uses a query-param pattern; update to match your contract.

    const codes = String(property_codes).split(',').map((s: string) => s.trim()).join(',')
    const body = await req.json().catch(() => ({}))
    const fromYear  = body.from_year  ?? new Date().getFullYear()
    const fromMonth = body.from_month ?? 1

    const dataRes = await fetch(
      `https://api.str.com/v1/reports/benchmarking?propertyCodes=${codes}&year=${fromYear}&month=${fromMonth}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    if (!dataRes.ok) {
      const err = await dataRes.text()
      return finish('error', `STR data fetch failed (${dataRes.status}): ${err}`)
    }
    const strData = await dataRes.json()

    // ── Map STR response → comp_data rows ────────────────────────────────────
    // Adjust field names below to match what STR actually returns for your account.
    // STR typically returns: propertyCode, year, month, myOcc, myADR, myRevPAR,
    //   compSetOcc, compSetADR, compSetRevPAR, mpi (occ_index), ari (adr_index), rgi (revpar_index)

    const { data: assets } = await supabase.from('assets').select('id, name')
    const codeToAsset: Record<string, string> = {}
    for (const a of assets ?? []) {
      // Match on asset name or pre-configured mapping in config.asset_map
      const map = integration.config?.asset_map ?? {}
      if (map[a.id]) codeToAsset[map[a.id]] = a.id
    }

    const rows: unknown[] = []
    const records = Array.isArray(strData) ? strData : strData.data ?? []
    for (const r of records) {
      const assetId = codeToAsset[String(r.propertyCode)]
      if (!assetId) continue  // skip unmapped properties
      rows.push({
        asset_id:        assetId,
        period_month:    r.month,
        period_year:     r.year,
        my_occupancy:    r.myOcc    ?? r.my_occ    ?? null,
        my_adr:          r.myADR    ?? r.my_adr    ?? null,
        my_revpar:       r.myRevPAR ?? r.my_revpar ?? null,
        comp_set_occ:    r.compSetOcc    ?? r.comp_set_occ    ?? null,
        comp_set_adr:    r.compSetADR    ?? r.comp_set_adr    ?? null,
        comp_set_revpar: r.compSetRevPAR ?? r.comp_set_revpar ?? null,
        occ_index:       r.mpi ?? r.occ_index    ?? null,
        adr_index:       r.ari ?? r.adr_index    ?? null,
        revpar_index:    r.rgi ?? r.revpar_index  ?? null,
      })
    }

    if (rows.length === 0) return finish('success', 'No new records returned from STR', 0)

    const { error: upsertErr } = await supabase
      .from('comp_data')
      .upsert(rows, { onConflict: 'asset_id,period_month,period_year' })

    if (upsertErr) return finish('error', `Upsert failed: ${upsertErr.message}`)

    return finish('success', `Synced ${rows.length} benchmarking record(s) from STR`, rows.length)

  } catch (err) {
    return finish('error', err instanceof Error ? err.message : String(err))
  }
})
