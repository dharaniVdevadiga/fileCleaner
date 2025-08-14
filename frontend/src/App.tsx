import React, { useState } from 'react'

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
    }
  }
}

const API_BASE = 'http://localhost:5000';

export default function App() {
  const [screen, setScreen] = useState<'home' | 'loading' | 'preview' | 'done'>('home')
  const [folder, setFolder] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [toast, setToast] = useState<string>('')

  const chooseFolder = async () => {
    const picked = await window.electronAPI.chooseFolder()
    if (!picked) return
    setFolder(picked)
  }

  const analyze = async () => {
    if (!folder) return
    setScreen('loading')
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folder })
      })
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
      const data: Item[] = await res.json()

      // ensure each item has editable fields
      const normalized = data.map(it => ({
        ...it,
        action: it.action || 'move',
        suggested_folder: it.suggested_folder ?? 'Clean/'
      }))
      setItems(normalized)
      setScreen('preview')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setToast(e.message ?? 'Analyze failed')
      setScreen('home')
    }
  }

  const toggleAction = (idx: number, newAction: 'delete' | 'move') => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, action: newAction } : it))
  }

  const updateSuggestedFolder = (idx: number, folder: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, suggested_folder: folder } : it))
  }

  const applyChanges = async () => {
    try {
      const payload = {
        base_folder: folder,
        actions: items.map(it => ({
          path: it.path,
          action: it.action,
          suggested_folder: it.action === 'move' ? (it.suggested_folder || 'Clean/') : undefined
        }))
      }
      const res = await fetch(`${API_BASE}/apply-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const summary = await res.json()
      setToast(`Deleted: ${summary.deleted.length} | Moved: ${summary.moved.length} | Failed: ${summary.failed.length}`)
      setScreen('done')
      // small reset after success
      setTimeout(() => { setItems([]); setFolder(''); setScreen('home') }, 1200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setToast(e.message ?? 'Apply failed')
    }
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 16 }}>
      <Header toast={toast} clearToast={() => setToast('')} />
      {screen === 'home' && (
        <Home
          folder={folder}
          onPick={chooseFolder}
          onAnalyze={analyze}
        />
      )}
      {screen === 'loading' && <Loading />}
      {screen === 'preview' && (
        <Preview
          folder={folder}
          items={items}
          onToggle={toggleAction}
          onFolderChange={updateSuggestedFolder}
          onConfirm={applyChanges}
        />
      )}
      {screen === 'done' && <Done />}
    </div>
  )
}

function Header({ toast, clearToast }: { toast: string, clearToast: () => void }) {
  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Smart Image Organizer</h1>
      {toast && (
        <div
          onClick={clearToast}
          style={{
            padding: '8px 12px',
            background: '#16a34a',
            color: 'white',
            borderRadius: 8,
            marginBottom: 12,
            cursor: 'pointer',
            display: 'inline-block'
          }}
          title="Click to dismiss"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function Home({ folder, onPick, onAnalyze }: { folder: string, onPick: () => void, onAnalyze: () => void }) {
  return (
    <div>
      <button onClick={onPick} style={btn}>Choose Folder</button>
      {folder && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
          Selected: {folder}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button disabled={!folder} onClick={onAnalyze} style={{ ...btn, opacity: folder ? 1 : 0.5 }}>
          Analyze
        </button>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16 }}>Analyzing images…</div>
    </div>
  )
}

function Preview({
  folder, items, onToggle, onFolderChange, onConfirm
}: {
  folder: string,
  items: Item[],
  onToggle: (i: number, a: 'delete' | 'move') => void,
  onFolderChange: (i: number, f: string) => void,
  onConfirm: () => void
}) {
  return (
    <div>
      <div style={{ marginBottom: 12, color: '#666' }}>Folder: {folder}</div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {items.map((it, i) => (
          <div key={it.path} style={card}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <img
                src={`file://${it.path}`}
                alt={it.file}
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.file}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {it.is_blurry ? <Badge text="Blurry" color="#ef4444" /> : <Badge text="Sharp" color="#10b981" />}
                  {it.status.includes('duplicate') && <Badge text={`Duplicate of ${it.duplicate_of ?? ''}`} color="#f59e0b" />}
                  {typeof it.blur_score === 'number' && <Badge text={`Blur: ${it.blur_score!.toFixed(1)}`} color="#64748b" />}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
              <label>
                <input
                  type="radio"
                  name={`act-${i}`}
                  checked={it.action === 'delete'}
                  onChange={() => onToggle(i, 'delete')}
                /> Delete
              </label>
              <label>
                <input
                  type="radio"
                  name={`act-${i}`}
                  checked={it.action === 'move'}
                  onChange={() => onToggle(i, 'move')}
                /> Move to:
              </label>
              <input
                type="text"
                value={it.suggested_folder ?? ''}
                onChange={(e) => onFolderChange(i, e.target.value)}
                disabled={it.action !== 'move'}
                placeholder="Clean/"
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={onConfirm} style={{ ...btn, background: '#2563eb' }}>Confirm & Apply</button>
      </div>
    </div>
  )
}

function Done() {
  return <div style={{ padding: 24 }}>✅ Folders successfully changed.</div>
}

function Badge({ text, color }: { text: string, color: string }) {
  return (
    <span style={{
      fontSize: 12, padding: '3px 8px', borderRadius: 999,
      background: color, color: 'white'
    }}>{text}</span>
  )
}

const btn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: '#111827',
  color: 'white',
  border: 'none',
  cursor: 'pointer'
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid #eee',
  borderRadius: 12,
  background: 'white',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
}
