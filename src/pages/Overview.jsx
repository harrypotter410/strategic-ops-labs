import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useDeals, useAssets } from '../hooks/useData'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const COLORS = ['#2a6e47','#4a9e6e','#163d27','#c9a96e','#a8d5bc','#0288d1','#7b1fa2']
const STAGE_LABELS = { prospecting:'Prospecting', loi:'LOI Signed', due_diligence:'Due Diligence', closing:'Closing' }
const STAGE_PROGRESS = { prospecting:12, loi:35, due_diligence:65, closing:90 }
const ACTION_ICONS = { deal_created:'💼', deal_updated:'✏️', deal_stage_changed:'🔄', asset_created:'🏨', asset_updated:'✏️', task_created:'✅', task_completed:'✅', valuation_created:'📊', contact_created:'👤', checklist_completed:'☑️', debt_added:'🏦' }

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

export default function Overview() {
  const { deals } = useDeals()
  const { assets } = useAssets()
  const [tasks, setTasks] = useState([])
  const [debt, setDebt] = useState([])
  const [activity, setActivity] = useState([])

  useEffect(() => {
    supabase.from('tasks').select('*').in('status',['open','in_progress']).order('due_date',{ascending:true,nullsFirst:false}).limit(5).then(({data})=>setTasks(data||[]))
    supabase.from('asset_debt').select('*, assets(name)').order('maturity_date',{ascending:true}).then(({data})=>setDebt(data||[]))
    supabase.from('activity_stream').select('*').order('created_at',{ascending:false}).limit(8).then(({data})=>setActivity(data||[]))
  }, [])

  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage))

  // Portfolio totals
  const totalAcq = assets.reduce((s,a) => s+(parseFloat(a.acquisition_price)||0), 0)
  const totalVal = assets.reduce((s,a) => s+(parseFloat(a.current_value)||0), 0)
  const totalNOI = assets.reduce((s,a) => s+(parseFloat(a.noi_trailing)||0), 0)
  const totalDS  = assets.reduce((s,a) => s+(parseFloat(a.debt_service_annual)||0), 0)
  const unrealizedGain = totalVal - totalAcq
  const gainPct = totalAcq ? ((unrealizedGain/totalAcq)*100).toFixed(1) : null

  // FIX 1: Active count — count stabilized (not 'active')
  const stabilizedAssets = assets.filter(a => a.status === 'stabilized')

  // FIX 2: Weighted Unlevered YOC = Total Portfolio NOI ÷ Total Acquisition Price
  const wtdUnleveredYOC = totalAcq && totalNOI ? ((totalNOI/totalAcq)*100).toFixed(2) : null
  const wtdLeveredYOC = totalAcq && totalNOI && totalDS ? (((totalNOI-totalDS)/totalAcq)*100).toFixed(2) : null

  const weightedPipeline = activeDeals.reduce((s,d) => s+((parseFloat(d.ask_price)||0)*((d.close_probability||50)/100)), 0)

  const typeAlloc = ['hotel','resort','mixed','commercial'].map(type => ({
    name: type.charAt(0).toUpperCase()+type.slice(1),
    value: assets.filter(a=>a.type===type).reduce((s,a)=>s+(parseFloat(a.current_value)||0),0)
  })).filter(t=>t.value>0)

  const maturingDebt = debt.filter(d => {
    if (!d.maturity_date) return false
    const days = Math.ceil((new Date(d.maturity_date)-new Date())/(1000*60*60*24))
    return days >= 0 && days <= 365
  })
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date())

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <p>Kemmons Wilson Hospitality Partners · {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</p>
      </div>

      {/* Alerts */}
      {(maturingDebt.length>0||overdueTasks.length>0)&&(
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          {maturingDebt.length>0&&<Link to="/debt" style={{textDecoration:'none'}}><div style={{background:'var(--amberL)',border:'1px solid #ffe082',borderRadius:8,padding:'8px 14px',fontSize:12,color:'var(--amber)'}}>⚠ {maturingDebt.length} loan{maturingDebt.length>1?'s':''} maturing within 12 months</div></Link>}
          {overdueTasks.length>0&&<Link to="/tasks" style={{textDecoration:'none'}}><div style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:8,padding:'8px 14px',fontSize:12,color:'var(--red)'}}>⚠ {overdueTasks.length} overdue task{overdueTasks.length>1?'s':''}</div></Link>}
        </div>
      )}

      <div className="kpi-grid">
        {/* FIX 1: Shows stabilized count correctly */}
        <div className="kpi-card">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-value">{assets.length}</div>
          <div className="kpi-change">{stabilizedAssets.length} stabilized</div>
        </div>

        {/* Portfolio Value with explanation */}
        <div className="kpi-card">
          <div className="kpi-label">
            <span className="tooltip-wrap" style={{cursor:'help'}}>
              Est. Portfolio Value ⓘ
              <div className="tooltip" style={{minWidth:230,fontWeight:400}}>
                <strong>How this is calculated:</strong><br/>
                Sum of "Current Value" across all {assets.length} assets.<br/>
                Update each asset's Current Value field to keep this accurate. It is not auto-calculated — it reflects whatever you enter.
              </div>
            </span>
          </div>
          <div className="kpi-value">{fmtM(totalVal)}</div>
          <div className="kpi-change">{fmtM(totalAcq)} cost basis · {gainPct?`${unrealizedGain>=0?'+':''}${gainPct}% gain`:''}</div>
        </div>

        {/* FIX 2: Wtd Unlevered YOC with formula */}
        <div className="kpi-card">
          <div className="kpi-label">
            <span className="tooltip-wrap" style={{cursor:'help'}}>
              Wtd. Unlevered YOC ⓘ
              <div className="tooltip" style={{minWidth:250,fontWeight:400}}>
                <strong>Weighted Unlevered Yield on Cost</strong><br/>
                Formula: Total NOI ÷ Total Acquisition Price<br/>
                = {fmtM(totalNOI)} ÷ {fmtM(totalAcq)}<br/><br/>
                <strong>Unlevered</strong> = before debt service (gross yield).<br/>
                Levered YOC (after DS): {wtdLeveredYOC?`${wtdLeveredYOC}%`:'—'}
              </div>
            </span>
          </div>
          <div className="kpi-value">{wtdUnleveredYOC?`${wtdUnleveredYOC}%`:'—'}</div>
          <div className="kpi-change">NOI ÷ acq. cost · before debt service</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Pipeline (Prob.-Weighted)</div>
          <div className="kpi-value">{fmtM(weightedPipeline)}</div>
          <div className="kpi-change">{activeDeals.length} active deals · {fmtM(activeDeals.reduce((s,d)=>s+(parseFloat(d.ask_price)||0),0))} gross</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:16,marginBottom:16}}>
        {/* Pipeline */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Acquisition pipeline</span><Link to="/pipeline"><button className="card-action">View all →</button></Link></div>
          {activeDeals.length===0?(
            <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px 0'}}>No active deals — <Link to="/pipeline" style={{color:'var(--g600)'}}>add one</Link></div>
          ):activeDeals.slice(0,5).map(deal=>(
            <div key={deal.id} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:2}}>
                <Link to={`/deals/${deal.id}`} style={{color:'var(--g900)',fontWeight:500,textDecoration:'none'}}>{deal.name}</Link>
                <div style={{display:'flex',gap:8}}>
                  {deal.close_probability&&<span style={{fontSize:10,color:'var(--gray500)'}}>{deal.close_probability}%</span>}
                  <span style={{color:'var(--gray500)'}}>{fmtM(deal.ask_price)}</span>
                </div>
              </div>
              <div style={{fontSize:10,color:'var(--gray500)',marginBottom:3}}>{STAGE_LABELS[deal.stage]||deal.stage}{deal.projected_irr?` · ${deal.projected_irr}% IRR`:''}</div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${STAGE_PROGRESS[deal.stage]||10}%`}}/></div>
            </div>
          ))}
        </div>

        {/* Allocation */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">By type</span></div>
          {typeAlloc.length>0?(<>
            <ResponsiveContainer width="100%" height={90}>
              <PieChart><Pie data={typeAlloc} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" paddingAngle={2}>
                {typeAlloc.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie><Tooltip formatter={v=>[fmtM(v),'']} contentStyle={{fontSize:11,borderRadius:6}}/></PieChart>
            </ResponsiveContainer>
            {typeAlloc.map((t,i)=>(
              <div key={t.name} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,marginBottom:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:COLORS[i],flexShrink:0}}/>
                <span style={{color:'var(--gray700)',flex:1}}>{t.name}</span>
                <span style={{color:'var(--g900)',fontWeight:500}}>{totalVal?`${((t.value/totalVal)*100).toFixed(0)}%`:''}</span>
              </div>
            ))}
          </>):<div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px 0'}}>Add current values to assets</div>}
        </div>

        {/* Tasks */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-header"><span className="card-title">Open tasks</span><Link to="/tasks"><button className="card-action">All →</button></Link></div>
          {tasks.length===0?(
            <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px 0'}}>No open tasks</div>
          ):tasks.map(t=>{
            const isOverdue=t.due_date&&new Date(t.due_date)<new Date()
            return (
              <div key={t.id} style={{display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid var(--gray100)',alignItems:'flex-start'}}>
                <div style={{width:12,height:12,borderRadius:3,border:'1.5px solid var(--gray300)',flexShrink:0,marginTop:2}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:'var(--g900)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                  {t.due_date&&<div style={{fontSize:10,color:isOverdue?'var(--red)':'var(--gray500)'}}>{isOverdue?'⚠ ':''}{new Date(t.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>}
                </div>
              </div>
            )
          })}
          <Link to="/tasks"><button className="btn btn-secondary btn-sm" style={{width:'100%',justifyContent:'center',marginTop:10}}>+ Add Task</button></Link>
        </div>
      </div>

      {/* Portfolio stats row */}
      <div className="card">
        <div className="card-header"><span className="card-title">Portfolio at a glance</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {[
            ['Total Rooms', assets.reduce((s,a)=>s+(a.rooms||0),0).toLocaleString()],
            ['Markets', `${[...new Set(assets.map(a=>a.market).filter(Boolean))].length}`],
            ['Total T12 NOI', fmtM(totalNOI)],
            ['Unrealized Gain', `${unrealizedGain>=0?'+':''}${fmtM(unrealizedGain)}`],
          ].map(([l,v])=>(
            <div key={l} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
              <div style={{fontSize:15,fontWeight:500,color:'var(--g900)'}}>{v||'—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity stream */}
      {activity.length>0&&(
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent activity</span>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--gray500)'}}>
              <div className="realtime-dot"/><span>Live</span>
            </div>
          </div>
          {activity.map(a=>(
            <div key={a.id} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid var(--gray100)',alignItems:'flex-start'}}>
              <span style={{fontSize:14,flexShrink:0}}>{ACTION_ICONS[a.action_type]||'•'}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'var(--gray700)',lineHeight:1.5}}>
                  <strong>{a.entity_name}</strong>{a.description?` — ${a.description}`:''}
                </div>
              </div>
              <div style={{fontSize:10,color:'var(--gray500)',whiteSpace:'nowrap'}}>{timeAgo(a.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
