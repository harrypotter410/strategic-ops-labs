// SOUL — Amadeus Sync Edge Function
// Authenticates with Amadeus OAuth, fetches hotel content data,
// and can be extended to pull demand or availability metrics.
//
// Deploy: supabase functions deploy sync-amadeus
// Register: developers.amadeus.com (free sandbox → production)

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
    .insert({ platform: 'amadeus', status: 'running' })
    .select()
    .single()
  const logId = logRow?.id

  const finish = async (status: string, message: string, rows = 0) => {
    await supabase.from('sync_logs').update({ status, message, rows_synced: rows, completed_at: new Date().toISOString() }).eq('id', logId)
    await supabase.from('integrations').update({ last_sync_at: new Date().toISOString(), last_sync_status: status, last_sync_message: message }).eq('platform', 'amadeus')
    return json({ status, message, rows_synced: rows })
  }

  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('platform', 'amadeus')
      .single()

    if (!integration?.enabled) return finish('error', 'Amadeus integration is not enabled')

    const { client_id, client_secret, environment } = integration.credentials ?? {}
    if (!client_id || !client_secret) return finish('error', 'Missing Amadeus API key or secret')

    const isProd = environment === 'production'
    const baseUrl = isProd
      ? 'https://api.amadeus.com'
      : 'https://test.api.amadeus.com'

    // ── OAuth — Client Credentials ───────────────────────────────────────────
    const tokenRes = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id,
        client_secret,
      }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return finish('error', `Amadeus auth failed (${tokenRes.status}): ${err}`)
    }
    const { access_token } = await tokenRes.json()

    // ── Fetch hotel content for portfolio properties ──────────────────────────
    // The Amadeus Hotel Search API returns rich content: ratings, amenities, geo.
    // Map SOUL assets to Amadeus hotel codes (cityCode or chainCode queries).
    //
    // Endpoint: GET /v3/shopping/hotel-offers (availability + rates)
    //           GET /v1/reference-data/locations/hotels (search by city)
    //
    // The example below searches by IATA city codes extracted from asset markets.
    // You can also configure explicit hotelIds in integration.config.hotel_ids.

    const body = await req.json().catch(() => ({}))
    const { data: assets } = await supabase.from('assets').select('id, name, market')

    const hotelIds = (integration.config?.hotel_ids ?? '')
      .split(',').map((s: string) => s.trim()).filter(Boolean)

    if (hotelIds.length === 0) {
      return finish('success', 'No Amadeus hotel IDs configured — add hotelIds to config to sync rates', 0)
    }

    // Fetch hotel offers (rates/availability) for configured hotel IDs
    const checkIn  = body.check_in  ?? new Date().toISOString().split('T')[0]
    const checkOut = body.check_out ?? new Date(Date.now() + 86400000).toISOString().split('T')[0]

    const offersRes = await fetch(
      `${baseUrl}/v3/shopping/hotel-offers?hotelIds=${hotelIds.join(',')}&checkInDate=${checkIn}&checkOutDate=${checkOut}&adults=1&currency=USD`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    if (!offersRes.ok) {
      const err = await offersRes.text()
      return finish('error', `Amadeus hotel offers failed (${offersRes.status}): ${err}`)
    }
    const offersData = await offersRes.json()
    const offers = offersData.data ?? []

    // Amadeus rate data doesn't map directly to SOUL's financials/comp_data tables —
    // it's forward-looking availability. Log summary for now; extend to store in a
    // new `rate_data` table if you want to track Amadeus rates over time.
    const summary = offers.map((o: Record<string, unknown>) => ({
      hotelId: o.hotel?.hotelId,
      name: (o.hotel as Record<string, unknown>)?.name,
      lowestRate: ((o.offers as unknown[])?.[0] as Record<string, unknown>)?.price,
    }))

    return finish(
      'success',
      `Fetched rates for ${offers.length} hotel(s) from Amadeus. ${JSON.stringify(summary).slice(0, 200)}`,
      offers.length
    )

  } catch (err) {
    return finish('error', err instanceof Error ? err.message : String(err))
  }
})
