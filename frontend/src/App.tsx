import './styles.css'
import React, { useEffect, useState } from 'react'


type Item = {
  file: string
  path: string
  status: string[]
  duplicate_of?: string
  blur_score?: number
  is_blurry?: boolean
  action: 'delete' | 'move'
  suggested_folder?: string
  target_folder?: string
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

export default function App() {
  const [screen, setScreen] = useState<'home' | 'loading' | 'preview' | 'done'>('home')
  const [folder, setFolder] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [toast, setToast] = useState<string>('')
  const [previews, setPreviews] = useState<Record<string, string>>({}) 
  const [loadingComplete, setLoadingComplete] = useState(false)

  const chooseFolder = async () => {
    const picked = await window.electronAPI.chooseFolder()
    if (!picked) return
    setFolder(picked)
  }

  const analyze = async () => {
  if (!folder) return
  setLoadingComplete(false)        
  setScreen('loading')
  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path: folder })
    })
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
    const data: Item[] = await res.json()

    const normalized = data.map(it => ({
      ...it,
      action: it.action || 'move',
      suggested_folder: it.suggested_folder ?? 'Clean/'
    }))

    setItems(normalized)
    setLoadingComplete(true)        
    // tiny delay so users see it hit 100%
    setTimeout(() => setScreen('preview'), 150)

    // load previews (unchanged)...
    Promise.allSettled(
      normalized.map(async (it) => {
        try {
          const src = await window.electronAPI.fileToDataURL(it.path)
          setPreviews(prev => (prev[it.path] ? prev : { ...prev, [it.path]: src }))
        } catch {}
      })
    )
  } catch (e: any) {
    setToast(e.message ?? 'Analyze failed')
    setLoadingComplete(true)     
    setTimeout(() => setScreen('home'), 150)
  }
}


  const toggleAction = (idx: number, newAction: 'delete' | 'move') => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, action: newAction } : it)))
  }

  const updateSuggestedFolder = (idx: number, folder: string) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, suggested_folder: folder } : it)))
  }

  const applyChanges = async () => {
    try {
      const payload = {
        base_folder: folder,
        actions: items.map(it => ({
          path: it.path,
          action: it.action,
          suggested_folder: it.action === 'move' ? it.suggested_folder || 'Clean/' : undefined
        }))
      }
      const res = await fetch(`${API_BASE}/apply-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const summary = await res.json()
      setToast(`Changes applied successfully!  Deleted: ${summary.deleted.length} | Moved: ${summary.moved.length} | Failed: ${summary.failed.length}`)
      setScreen('done')
      setTimeout(() => { setItems([]); setFolder(''); setScreen('home'); setToast('') }, 2500)
    } catch (e: any) {
      setToast(e.message ?? 'Apply failed')
    }
  }

  return (
    <div className="app-window">
      <div className="app-panel">
        <div className="window-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
        </div>

        {toast && (
          <div className="toast" onClick={() => setToast('')}>
            {toast} <small>Click to dismiss</small>
          </div>
        )}

        {screen === 'home' && <Home folder={folder} onPick={chooseFolder} onAnalyze={analyze} />}
        {screen === 'loading' && <Loading complete= {loadingComplete} />}
        {screen === 'preview' && (
          <Preview
            folder={folder}
            items={items}
            previews={previews}    
            onToggle={toggleAction}
            onFolderChange={updateSuggestedFolder}
            onConfirm={applyChanges}
          />
        )}
        {screen === 'done' && <Done />}
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

function Loading({ complete }: { complete: boolean }) {
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
      </div>
    </>
  )
}

function Preview({
  folder,
  items,
  previews,
  onToggle,
  onFolderChange,
  onConfirm
}: {
  folder: string
  items: Item[]
  previews: Record<string, string>
  onToggle: (i: number, a: 'delete' | 'move') => void
  onFolderChange: (i: number, f: string) => void
  onConfirm: () => void
}) {
  return (
    <>
      <h1 className="h1">3. Confirm and Apply Changes!</h1>
      <div className="p" style={{ marginBottom: 12, color: 'var(--muted)' }}>Folder: {folder}</div>

      <div className="grid">
        {items.map((it, i) => (
          <div className="card" key={it.path}>
            <div className="row">
              {previews[it.path] ? (
                <img className="thumb" src={previews[it.path]} alt={it.file}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                
                <div className="thumb" style={{display:'grid',placeItems:'center',fontSize:12,color:'#aaa'}}>
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
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
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
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={onConfirm}>Confirm &amp; Apply</button>
      </div>
    </>
  )
}

function Done() {
  return <div className="center"></div>
}

/* ---------- UI bits ---------- */

function Badge({ text, tone }: { text: string; tone: 'green' | 'red' | 'orange' | 'gray' }) {
  return <span className={`badge ${tone}`}>{text}</span>
}