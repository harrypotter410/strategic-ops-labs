import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('assets').select('*').order('name')
    if (error) setError(error)
    else setAssets(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const addAsset = async (asset) => {
    const { data, error } = await supabase.from('assets').insert(asset).select().single()
    if (!error) setAssets(prev => [...prev, data])
    return { data, error }
  }

  const updateAsset = async (id, updates) => {
    const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single()
    if (!error) setAssets(prev => prev.map(a => a.id === id ? data : a))
    return { data, error }
  }

  const deleteAsset = async (id) => {
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (!error) setAssets(prev => prev.filter(a => a.id !== id))
    return { error }
  }

  return { assets, loading, error, refetch: fetch, addAsset, updateAsset, deleteAsset }
}

export function useFinancials(assetId = null) {
  const [financials, setFinancials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      let query = supabase.from('financials').select('*, assets(name, type, market)').order('period_year', { ascending: false }).order('period_month', { ascending: false })
      if (assetId) query = query.eq('asset_id', assetId)
      const { data, error } = await query
      if (!error) setFinancials(data)
      setLoading(false)
    }
    fetch()
  }, [assetId])

  const addFinancials = async (rows) => {
    const { data, error } = await supabase.from('financials').insert(rows).select()
    if (!error) setFinancials(prev => [...prev, ...data])
    return { data, error }
  }

  return { financials, loading, addFinancials }
}

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('deals').select('*, deal_checklist(*)').order('created_at', { ascending: false })
    if (!error) setDeals(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const addDeal = async (deal) => {
    const { data, error } = await supabase.from('deals').insert(deal).select().single()
    if (!error) setDeals(prev => [...prev, { ...data, deal_checklist: [] }])
    return { data, error }
  }

  const updateDeal = async (id, updates) => {
    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select().single()
    if (!error) setDeals(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
    return { data, error }
  }

  const toggleChecklist = async (itemId, completed) => {
    const { error } = await supabase.from('deal_checklist').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', itemId)
    if (!error) fetch()
    return { error }
  }

  const addChecklistItem = async (dealId, item) => {
    const { data, error } = await supabase.from('deal_checklist').insert({ deal_id: dealId, item }).select().single()
    if (!error) fetch()
    return { data, error }
  }

  return { deals, loading, refetch: fetch, addDeal, updateDeal, toggleChecklist, addChecklistItem }
}

export function usePortfolioSummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [assetsRes, financialsRes, dealsRes] = await Promise.all([
        supabase.from('assets').select('*'),
        supabase.from('financials').select('*').eq('period_year', new Date().getFullYear()),
        supabase.from('deals').select('*').not('stage', 'in', '("closed","dead")'),
      ])
      const assets = assetsRes.data || []
      const fin = financialsRes.data || []
      const deals = dealsRes.data || []

      const totalRevenue = fin.reduce((s, f) => s + (f.revenue || 0), 0)
      const totalNOI = fin.reduce((s, f) => s + (f.noi || 0), 0)
      const avgOcc = fin.length ? fin.reduce((s, f) => s + (f.occupancy || 0), 0) / fin.filter(f => f.occupancy).length : 0
      const pipelineValue = deals.reduce((s, d) => s + (d.ask_price || 0), 0)

      setSummary({
        totalAssets: assets.length,
        activeAssets: assets.filter(a => a.status === 'active').length,
        totalRevenue,
        totalNOI,
        avgOccupancy: Math.round(avgOcc),
        pipelineDeals: deals.length,
        pipelineValue,
        portfolioValue: assets.reduce((s, a) => s + (a.current_value || 0), 0),
      })
      setLoading(false)
    }
    fetch()
  }, [])

  return { summary, loading }
}
