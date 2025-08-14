import React, { useMemo, useRef, useState, useEffect } from 'react'
import './styles.css'

type Item = {
  file: string
  path: string
  status: string[]
  duplicate_of?: string
  blur_score?: number
  is_blurry?: boolean
  action: 'delete' | 'move'
  suggested_folder?: string
}

declare global {
  interface Window {
    electronAPI: {
      chooseFolder: () => Promise<string | null>
      fileToDataURL: (p: string) => Promise<string>
    }
  }
}

const API_BASE = 'http://localhost:5000'

type Settings = {
  defaultMoveFolder: string
  thumbSize: number
}
const loadSettings = (): Settings => {
  try { return JSON.parse(localStorage.getItem('settings') || '') as Settings }
  catch { return { defaultMoveFolder: 'Clean/', thumbSize: 110 } }
}
const saveSettings = (s: Settings) => localStorage.setItem('settings', JSON.stringify(s))

export default function App() {
  const [screen, setScreen] = useState<'home' | 'loading' | 'preview' | 'done'>('home')
  const [folder, setFolder] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [toast, setToast] = useState<string>('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loadingComplete, setLoadingComplete] = useState(false)
  const [err, setErr] = useState<string>('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const analyzeAbort = useRef<AbortController | null>(null)

  const counts = useMemo(() => {
    const del = items.filter(i => i.action === 'delete').length
    const move = items.length - del
    return { total: items.length, del, move }
  }, [items])

  const chooseFolder = async () => {
    const picked = await window.electronAPI.chooseFolder()
    if (!picked) return
    setFolder(picked)
  }

  const loadPreviews = async (data: Item[]) => {
    setPreviews({})
    await Promise.allSettled(
      data.map(async it => {
        try {
          const src = await window.electronAPI.fileToDataURL(it.path)
          setPreviews(prev => (prev[it.path] ? prev : { ...prev, [it.path]: src }))
        } catch { /* ignore */ }
      })
    )
  }

  const analyze = async () => {
    if (!folder) return
    setErr('')
    setLoadingComplete(false)
    setScreen('loading')
    analyzeAbort.current?.abort()
    const controller = new AbortController()
    analyzeAbort.current = controller
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folder }),
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
      const data: Item[] = await res.json()

      const normalized = data.map(it => ({
        ...it,
        action: it.action || 'move',
        suggested_folder: it.suggested_folder ?? settings.defaultMoveFolder
      }))
      setItems(normalized)
      setLoadingComplete(true)
      setTimeout(() => setScreen('preview'), 150)
      loadPreviews(normalized)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setErr(e?.message ?? 'Analyze failed')
      setLoadingComplete(true)
      setTimeout(() => setScreen('home'), 150)
    }
  }

  const cancelAnalyze = () => {
    analyzeAbort.current?.abort()
    setLoadingComplete(true)
    setScreen('home')
  }

  const toggleAction = (idx: number, newAction: 'delete' | 'move') => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, action: newAction } : it)))
  }

  const updateSuggestedFolder = (idx: number, folder: string) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, suggested_folder: folder } : it)))
  }

  const [lastMoveBack, setLastMoveBack] = useState<{ base: string, actions: { path: string, action:'move', target_folder: string }[] } | null>(null)

  const applyChanges = async () => setShowConfirm(true)

  const confirmApply = async () => {
    setShowConfirm(false)
    try {
      const payload = {
        base_folder: folder,
        actions: items.map(it => ({
          path: it.path,
          action: it.action,
          suggested_folder: it.action === 'move' ? (it.suggested_folder || settings.defaultMoveFolder) : undefined
        }))
      }
      const res = await fetch(`${API_BASE}/apply-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const summary = await res.json()

      const moveBack = (summary.moved as string[]).map((newPath: string) => ({
        path: newPath,
        action: 'move' as const,
        target_folder: folder  
      }))
      setLastMoveBack({ base: folder, actions: moveBack })

      setToast(`Deleted: ${summary.deleted.length} | Moved: ${summary.moved.length} | Failed: ${summary.failed.length}`)
      setScreen('done')
      setTimeout(() => { setItems([]); setFolder(''); setScreen('home') }, 1600)
    } catch (e: any) {
      setErr(e?.message ?? 'Apply failed')
    }
  }


  useEffect(() => { saveSettings(settings) }, [settings])

  return (
    <div className="app-window">
      <div className="app-panel">
        <div className="window-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
        </div>

        {/* header row: steps + settings button */}
        <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'space-between'}}>
          <div className="steps" style={{flex:1}}>
            <div className={`step ${screen==='home'?'active':''}`}>1</div>
            <div className="step-line" />
            <div className={`step ${screen==='loading'?'active':''}`}>2</div>
            <div className="step-line" />
            <div className={`step ${screen==='preview' || screen==='done' ?'active':''}`}>3</div>
          </div>
          <button className="icon-btn" onClick={()=>setShowSettings(true)}>Settings</button>
        </div>

        {/* error banner */}
        {err && <div className="banner">{err}</div>}

        {toast && (
          <div className="toast" onClick={() => setToast('')}>
            {toast} <small>Click to dismiss</small>
          </div>
        )}

        {screen === 'home' && (
          <Home
            folder={folder}
            onPick={chooseFolder}
            onAnalyze={analyze}
          />
        )}

        {screen === 'loading' && <Loading complete={loadingComplete} onCancel={cancelAnalyze} />}

        {screen === 'preview' && (
          <Preview
            folder={folder}
            items={items}
            previews={previews}
            thumbSize={settings.thumbSize}
            onToggle={toggleAction}
            onFolderChange={updateSuggestedFolder}
            onConfirm={applyChanges}
          />
        )}

        {screen === 'done' && <div className="center">Done!</div>}

        {/* modals */}
        {showConfirm && (
          <ModalConfirm
            counts={counts}
            onCancel={()=>setShowConfirm(false)}
            onConfirm={confirmApply}
          />
        )}

        {showSettings && (
          <ModalSettings
            settings={settings}
            onClose={()=>setShowSettings(false)}
            onSave={(s)=>{ setSettings(s); setShowSettings(false) }}
          />
        )}

      </div>
    </div>
  )
}

/* ---------- Screens ---------- */

function Home({ folder, onPick, onAnalyze }: { folder: string; onPick: () => void; onAnalyze: () => void }) {
  return (
    <>
      <h1 className="h1">1. Pick the folder you want to clean!</h1>
      <div className="row" style={{ gap: 16 }}>
        <button className="btn btn-primary" onClick={onPick}>Choose your Folder</button>
        <button className={`btn btn-soft ${!folder ? 'btn-disabled' : ''}`} disabled={!folder} onClick={onAnalyze}>
          Clean
        </button>
      </div>
      {folder && <p className="p" style={{ marginTop: 10 }}>Selected: {folder}</p>}
    </>
  )
}

function Loading({ complete, onCancel }: { complete: boolean; onCancel: () => void }) {
  const [pct, setPct] = useState(8)
  useEffect(() => {
    let t: any
    const tick = () => {
      setPct(prev => {
        const target = complete ? 100 : 90
        const step = Math.max(1, Math.round((target - prev) / 6))
        return Math.min(target, prev + step)
      })
      t = setTimeout(tick, 220)
    }
    tick()
    return () => clearTimeout(t)
  }, [complete])

  return (
    <>
      <h1 className="h1">2. Wait for the program to clean your files!</h1>
      <div className="progress-wrap">
        <div className="progress" style={{ ['--w' as any]: `${pct}%` }}>
          <div className="bar" />
        </div>
        <div className="progress-label">Analyzing images… {pct}%</div>
        <button className="btn btn-soft" onClick={onCancel} style={{marginTop:12}}>Cancel</button>
      </div>
    </>
  )
}

type PreviewProps = {
  folder: string
  items: Item[]
  previews: Record<string, string>
  thumbSize: number
  onToggle: (i: number, a: 'delete' | 'move') => void
  onFolderChange: (i: number, f: string) => void
  onConfirm: () => void
}

function Preview({
  folder,
  items,
  previews,
  thumbSize,
  onToggle,
  onFolderChange,
  onConfirm
}: {
  folder: string
  items: Item[]
  previews: Record<string, string>
  thumbSize: number
  onToggle: (i: number, a: 'delete' | 'move') => void
  onFolderChange: (i: number, f: string) => void
  onConfirm: () => void
}) {
  const deleteCount = items.filter(i => i.action === 'delete').length
  const moveCount = items.length - deleteCount

  return (
    <>
       <h1 className="h1">3. Confirm and Apply Changes!</h1>
      <div className="p" style={{ marginBottom: 12, color: 'var(--muted)' }}>Folder: {folder}</div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="card" style={{ padding: 18 }}>Nothing to clean here 🎉</div>
      ) : (
        <div className="grid">
          {items.map((it, i) => (
            <div className="card" key={it.path}>
              <div className="row">
                {previews[it.path] ? (
                  <img
                    className="thumb"
                    style={{ width: thumbSize, height: thumbSize }}
                    src={previews[it.path]}
                    alt={it.file}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="thumb"
                       style={{ width: thumbSize, height: thumbSize, display:'grid', placeItems:'center', fontSize:12, color:'#aaa' }}>
                    No preview
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h2" style={{ margin: '0 0 6px' }}>{it.file}</div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {it.is_blurry ? <Badge text="Blurry" tone="red" /> : <Badge text="Sharp" tone="green" />}
                    {it.status.includes('duplicate') && <Badge text={`Duplicate of ${it.duplicate_of ?? ''}`} tone="orange" />}
                    {typeof it.blur_score === 'number' && <Badge text={`Blur: ${it.blur_score!.toFixed(1)}`} tone="gray" />}
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    <label>
                      <input type="radio" name={`act-${i}`} checked={it.action === 'delete'} onChange={() => onToggle(i, 'delete')} /> Delete
                    </label>
                    <label>
                      <input type="radio" name={`act-${i}`} checked={it.action === 'move'} onChange={() => onToggle(i, 'move')} /> Move to:
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={it.suggested_folder ?? ''}
                      onChange={e => onFolderChange(i, e.target.value)}
                      disabled={it.action !== 'move'}
                      placeholder="Clean/"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky footer summary (stays inside the panel; no extra scrollbar) */}
      <div className="footer">
        <div className="p">Items: {items.length} • Delete: {deleteCount} • Move: {moveCount}</div>
        <button className={`btn btn-primary ${items.length===0 ? 'btn-disabled':''}`}
                disabled={items.length===0}
                onClick={onConfirm}>
          Confirm &amp; Apply
        </button>
      </div>
    </>
  )
}

/* ---------- Modals ---------- */

function ModalConfirm({ counts, onCancel, onConfirm }: { counts: {total:number, del:number, move:number}, onCancel: ()=>void, onConfirm: ()=>void }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h3>Apply changes?</h3>
        <div className="p">You’re about to <b>delete {counts.del}</b> and <b>move {counts.move}</b> items.</div>
        <div className="actions">
          <button className="btn btn-soft" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Yes, apply</button>
        </div>
      </div>
    </div>
  )
}

function ModalSettings({ settings, onClose, onSave }: { settings: Settings, onClose: ()=>void, onSave: (s:Settings)=>void }) {
  const [local, setLocal] = useState<Settings>(settings)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h3>Settings</h3>
        <div className="p" style={{marginBottom:10}}>These are UI preferences. Backend thresholds are read-only for now.</div>
        <div className="row" style={{marginBottom:10}}>
          <label style={{minWidth:180}}>Default move folder</label>
          <input className="input" value={local.defaultMoveFolder} onChange={e=>setLocal({...local, defaultMoveFolder:e.target.value})} />
        </div>
        <div className="row" style={{marginBottom:10}}>
          <label style={{minWidth:180}}>Thumbnail size (px)</label>
          <input className="input" type="number" min={80} max={220} value={local.thumbSize}
            onChange={e=>setLocal({...local, thumbSize: Math.max(80, Math.min(220, Number(e.target.value)||110))})} />
        </div>
        <div className="actions">
          <button className="btn btn-soft" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={()=>onSave(local)}>Save</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- UI bits ---------- */
function Badge({ text, tone }: { text: string; tone: 'green' | 'red' | 'orange' | 'gray' }) {
  return <span className={`badge ${tone}`}>{text}</span>
}