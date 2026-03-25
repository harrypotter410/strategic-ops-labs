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
    else setAssets(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const addAsset = async (asset) => {
    const { data, error } = await supabase.from('assets').insert(asset).select().single()
    if (!error) setAssets(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
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
      let query = supabase
        .from('financials')
        .select('*, assets(name, type, market)')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
      if (assetId) query = query.eq('asset_id', assetId)
      const { data, error } = await query
      if (!error) setFinancials(data || [])
      setLoading(false)
    }
    fetch()
  }, [assetId])

  const addFinancials = async (rows) => {
    const { data, error } = await supabase.from('financials').insert(rows).select()
    if (!error) setFinancials(prev => [...prev, ...(data || [])])
    return { data, error }
  }

  return { financials, loading, addFinancials }
}

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('*, deal_checklist(*)')
      .order('created_at', { ascending: false })
    if (!error) setDeals(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const addDeal = async (deal) => {
    const { data, error } = await supabase.from('deals').insert(deal).select().single()
    if (!error) setDeals(prev => [{ ...data, deal_checklist: [] }, ...prev])
    return { data, error }
  }

  const updateDeal = async (id, updates) => {
    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select().single()
    if (!error) setDeals(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
    return { data, error }
  }

  const deleteDeal = async (id) => {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (!error) setDeals(prev => prev.filter(d => d.id !== id))
    return { error }
  }

  const toggleChecklist = async (itemId, completed) => {
    const { error } = await supabase
      .from('deal_checklist')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', itemId)
    if (!error) {
      setDeals(prev => prev.map(d => ({
        ...d,
        deal_checklist: (d.deal_checklist || []).map(item =>
          item.id === itemId ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null } : item
        )
      })))
    }
    return { error }
  }

  const addChecklistItem = async (dealId, item) => {
    const { data, error } = await supabase
      .from('deal_checklist')
      .insert({ deal_id: dealId, item, completed: false })
      .select()
      .single()
    if (!error) {
      setDeals(prev => prev.map(d =>
        d.id === dealId ? { ...d, deal_checklist: [...(d.deal_checklist || []), data] } : d
      ))
    }
    return { data, error }
  }

  return { deals, loading, refetch: fetch, addDeal, updateDeal, deleteDeal, toggleChecklist, addChecklistItem }
}

export function usePortfolioSummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [assetsRes, dealsRes] = await Promise.all([
        supabase.from('assets').select('*'),
        supabase.from('deals').select('*').not('stage', 'in', '("closed","dead")'),
      ])
      const assets = assetsRes.data || []
      const deals = dealsRes.data || []

      // Calculate avg occupancy from assets that have it
      const assetsWithOcc = assets.filter(a => a.occupancy)
      const avgOccupancy = assetsWithOcc.length
        ? Math.round(assetsWithOcc.reduce((s,a) => s + a.occupancy, 0) / assetsWithOcc.length)
        : null

      setSummary({
        totalAssets: assets.length,
        activeAssets: assets.filter(a => a.status === 'active').length,
        avgOccupancy,
        pipelineDeals: deals.length,
        pipelineValue: deals.reduce((s, d) => s + (d.ask_price || 0), 0),
        portfolioValue: assets.reduce((s, a) => s + (a.current_value || 0), 0),
      })
      setLoading(false)
    }
    fetch()
  }, [])

  return { summary, loading }
}
