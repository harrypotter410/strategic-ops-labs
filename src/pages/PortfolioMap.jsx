import { useEffect, useRef, useState } from 'react'
import { useAssets, useDeals } from '../hooks/useData'

// Geocode an address using OpenStreetMap Nominatim (free, no API key)
export async function geocodeAddress(address) {
  try {
    const encoded = encodeURIComponent(address)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SOUL-KWH-App' }
    })
    const data = await res.json()
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    return null
  } catch {
    return null
  }
}

const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

function MapPopup({ item, type, onClose }) {
  const isAsset = type === 'asset'
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--white)', border: '1px solid var(--gray100)', borderRadius: 12,
      padding: '16px 20px', width: 280, zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--g900)', fontFamily: 'Playfair Display, serif', marginBottom: 2 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--gray500)' }}>{item.market}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--gray500)', lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {isAsset ? (<>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Type</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{item.type?.charAt(0).toUpperCase()+item.type?.slice(1)}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Rooms</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{item.rooms?.toLocaleString() || '—'}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Value</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{fmt(item.current_value)}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Status</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: item.status==='active'?'var(--g600)':item.status==='renovation'?'var(--blue)':'var(--amber)' }}>{item.status?.charAt(0).toUpperCase()+item.status?.slice(1)}</div>
          </div>
        </>) : (<>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Ask Price</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{fmt(item.ask_price)}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Stage</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{STAGE_LABELS[item.stage]}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Cap Rate</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{item.cap_rate ? `${item.cap_rate}%` : '—'}</div>
          </div>
          <div style={{ background: 'var(--gray50)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>IRR</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{item.projected_irr ? `${item.projected_irr}%` : '—'}</div>
          </div>
        </>)}
      </div>
    </div>
  )
}

export default function PortfolioMap() {
  const { assets } = useAssets()
  const { deals } = useDeals()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [selected, setSelected] = useState(null)
  const [showAssets, setShowAssets] = useState(true)
  const [showDeals, setShowDeals] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage))
  const mappableAssets = assets.filter(a => a.latitude && a.longitude)
  const mappableDeals = activeDeals.filter(d => d.latitude && d.longitude)

  // Load Leaflet
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return
    const L = window.L
    const map = L.map(mapRef.current, {
      center: [33.5, -86.5],
      zoom: 6,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18,
    }).addTo(map)
    mapInstanceRef.current = map
  }, [mapLoaded])

  // Draw markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const L = window.L
    const map = mapInstanceRef.current

    // Clear existing markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    // Asset markers — solid green circles
    if (showAssets) {
      mappableAssets.forEach(asset => {
        const color = asset.status === 'active' ? '#2a6e47' : asset.status === 'renovation' ? '#1565c0' : '#f39c12'
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        const marker = L.marker([asset.latitude, asset.longitude], { icon })
          .addTo(map)
          .on('click', () => setSelected({ item: asset, type: 'asset' }))
        markersRef.current.push(marker)
      })
    }

    // Deal markers — diamond shapes in amber/gold
    if (showDeals) {
      mappableDeals.forEach(deal => {
        const stageColors = { prospecting: '#9a9088', loi: '#c9a96e', due_diligence: '#c07a20', closing: '#2a6e47' }
        const color = stageColors[deal.stage] || '#9a9088'
        const icon = L.divIcon({
          html: `<div style="width:12px;height:12px;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);transform:rotate(45deg);"></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })
        const marker = L.marker([deal.latitude, deal.longitude], { icon })
          .addTo(map)
          .on('click', () => setSelected({ item: deal, type: 'deal' }))
        markersRef.current.push(marker)
      })
    }

    // Fit bounds if we have markers
    const allPoints = [
      ...(showAssets ? mappableAssets.map(a => [a.latitude, a.longitude]) : []),
      ...(showDeals ? mappableDeals.map(d => [d.latitude, d.longitude]) : []),
    ]
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 9 })
    }
  }, [mapLoaded, mappableAssets, mappableDeals, showAssets, showDeals])

  const totalRooms = mappableAssets.reduce((s, a) => s + (a.rooms || 0), 0)
  const totalValue = mappableAssets.reduce((s, a) => s + (a.current_value || 0), 0)
  const unmappedAssets = assets.filter(a => !a.latitude || !a.longitude)
  const unmappedDeals = activeDeals.filter(d => !d.latitude || !d.longitude)

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Map</h1>
        <p>Geographic view of all assets and active pipeline deals</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Assets on map</div><div className="kpi-value">{mappableAssets.length}</div><div className="kpi-change">{assets.length} total assets</div></div>
        <div className="kpi-card"><div className="kpi-label">Pipeline deals</div><div className="kpi-value">{mappableDeals.length}</div><div className="kpi-change">{activeDeals.length} active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Total rooms mapped</div><div className="kpi-value">{totalRooms.toLocaleString()}</div><div className="kpi-change">Across {[...new Set(mappableAssets.map(a=>a.market))].length} markets</div></div>
        <div className="kpi-card"><div className="kpi-label">Mapped portfolio value</div><div className="kpi-value">{fmt(totalValue)}</div><div className="kpi-change">Current value</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Map controls */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--gray700)' }}>
              <input type="checkbox" checked={showAssets} onChange={e => setShowAssets(e.target.checked)} style={{ accentColor: 'var(--g600)' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--g600)', display: 'inline-block', border: '1.5px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></span>
                Portfolio assets ({mappableAssets.length})
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--gray700)' }}>
              <input type="checkbox" checked={showDeals} onChange={e => setShowDeals(e.target.checked)} style={{ accentColor: 'var(--g600)' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, background: 'var(--brass)', display: 'inline-block', transform: 'rotate(45deg)', border: '1.5px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></span>
                Pipeline deals ({mappableDeals.length})
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--gray500)', alignItems: 'center' }}>
            {[
              { color: '#2a6e47', label: 'Active' },
              { color: '#1565c0', label: 'Renovation' },
              { color: '#f39c12', label: 'Review' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                {label}
              </span>
            ))}
            <span style={{ marginLeft: 8 }}>|</span>
            {[
              { color: '#9a9088', label: 'Prospecting' },
              { color: '#c9a96e', label: 'LOI' },
              { color: '#c07a20', label: 'DD' },
              { color: '#2a6e47', label: 'Closing' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, background: color, display: 'inline-block', transform: 'rotate(45deg)' }}></span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Map container */}
        <div style={{ position: 'relative' }}>
          <div ref={mapRef} style={{ height: 520, width: '100%' }} />
          {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray50)', fontSize: 13, color: 'var(--gray500)' }}>
              Loading map...
            </div>
          )}
          {selected && (
            <MapPopup item={selected.item} type={selected.type} onClose={() => setSelected(null)} />
          )}
        </div>
      </div>

      {/* Unmapped items warning */}
      {(unmappedAssets.length > 0 || unmappedDeals.length > 0) && (
        <div style={{ background: 'var(--amberL)', border: '1px solid #ffe082', borderRadius: 10, padding: '14px 18px', marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--amber)', marginBottom: 6 }}>Some items are missing coordinates</div>
          <div style={{ fontSize: 12, color: '#7a5500', lineHeight: 1.6 }}>
            {unmappedAssets.length > 0 && <div>Assets not on map: {unmappedAssets.map(a => a.name).join(', ')} — edit each asset and add a city/state address to auto-geocode.</div>}
            {unmappedDeals.length > 0 && <div style={{ marginTop: 4 }}>Deals not on map: {unmappedDeals.map(d => d.name).join(', ')} — edit each deal and ensure it has a market (e.g. "Nashville, TN").</div>}
          </div>
        </div>
      )}

      {/* Asset list */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><span className="card-title">Assets by market</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {mappableAssets.map(a => (
            <div key={a.id}
              style={{ background: selected?.item?.id === a.id ? 'var(--g50)' : 'var(--gray50)', border: `1px solid ${selected?.item?.id === a.id ? 'var(--g200)' : 'var(--gray100)'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s' }}
              onClick={() => {
                setSelected({ item: a, type: 'asset' })
                if (mapInstanceRef.current) mapInstanceRef.current.setView([a.latitude, a.longitude], 11)
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)', marginBottom: 2 }}>{a.name}</div>
              <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{a.market} · {a.rooms ? `${a.rooms} rooms` : a.type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
