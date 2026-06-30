import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import MessageList from './components/MessageList.jsx'
import Composer from './components/Composer.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import { buildChatRequest, parseStreamLine, buildHealthRequest, buildWarmupRequest } from './lib/ollama-adapter.js'

const BRAND = 'Phi Financial IA'

const DEFAULT_SETTINGS = {
  baseUrl: '', // "" = same-origin → proxy Vite → Ollama (aucun souci CORS)
  model: 'phi3.5-financial',
  temperature: 0.3,
  maxTokens: 2048, // num_predict — filet de sécurité (le prompt impose des réponses brèves)

  systemPrompt:
    "Tu es un conseiller financier et business. Réponds en français, de façon claire et " +
    "CONCISE : 3 à 6 phrases maximum, sans long développement (sauf demande explicite). Mets " +
    "en gras les termes clés. Si la question sort de la finance, réponds en une phrase puis recentre.",
}

const SUGGESTIONS = [
  "Explique l'EBITDA et le résultat net en termes simples.",
  'Comment valoriser une jeune entreprise SaaS ?',
  'Construis un plan de trésorerie sur 12 mois pour une petite entreprise.',
  "Quelle allocation d'actifs pour un profil de risque modéré ?",
]

const LS_SETTINGS = 'phi.settings'
const LS_CONVS = 'phi.conversations'
const LS_ACTIVE = 'phi.activeId'
const LS_THEME = 'phi.theme'
const SETTINGS_VERSION = 5 // bump → réaligne maxTokens (perf) sur le défaut

const nowTs = () => Date.now()
const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const titleFrom = (text) => {
  const t = (text || '').split('\n')[0].trim().replace(/\s+/g, ' ')
  if (!t) return 'Nouvelle conversation'
  return t.length > 42 ? t.slice(0, 42) + '…' : t
}

function deriveTitle(messages, fallback) {
  const u = messages.find((m) => m.role === 'user')
  return u ? titleFrom(u.content) : (fallback || 'Nouvelle conversation')
}

function loadJSON(key, fb) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fb
  } catch {
    return fb
  }
}

function loadTheme() {
  try {
    const t = localStorage.getItem(LS_THEME)
    if (t === 'light' || t === 'dark') return t
  } catch { /* ignore */ }
  try {
    if (globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches) return 'light'
  } catch { /* ignore */ }
  return 'dark'
}

function loadSettings() {
  const stored = loadJSON(LS_SETTINGS, {})
  const merged = { ...DEFAULT_SETTINGS, ...stored }
  // baseUrl est fixé côté code (.env → proxy), jamais par l'utilisateur.
  merged.baseUrl = ''
  // Tant que l'utilisateur n'a pas personnalisé le prompt, on suit le défaut.
  if (!stored.systemPromptCustom) {
    merged.systemPrompt = DEFAULT_SETTINGS.systemPrompt
  }
  if (stored.__v !== SETTINGS_VERSION) {
    merged.maxTokens = DEFAULT_SETTINGS.maxTokens
  }
  merged.__v = SETTINGS_VERSION
  return merged
}

function freshConversation() {
  return { id: genId(), title: 'Nouvelle conversation', messages: [], createdAt: nowTs(), updatedAt: nowTs() }
}

function loadConversations() {
  const arr = loadJSON(LS_CONVS, null)
  if (Array.isArray(arr) && arr.length) return arr
  // Migration éventuelle de l'ancien format mono-conversation.
  const old = loadJSON('phi.messages', [])
  if (Array.isArray(old) && old.length) {
    return [{ id: genId(), title: deriveTitle(old), messages: old, createdAt: nowTs(), updatedAt: nowTs() }]
  }
  return [freshConversation()]
}

// Dernier message utilisateur (sans le contenu des fichiers joints) — pour le rappel via ↑.
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const c = messages[i].content || ''
      const cut = c.indexOf('\n\n--- Fichier joint :')
      return cut >= 0 ? c.slice(0, cut) : c
    }
  }
  return ''
}

// Fenêtre glissante : n'envoie au modèle que les derniers messages (budget de
// caractères) → prefill borné, TTFT stable même sur de longues conversations.
const HISTORY_MAX_CHARS = 6000

function windowMessages(messages, maxChars) {
  const out = []
  let total = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    out.unshift(messages[i])
    total += (messages[i].content || '').length
    if (total >= maxChars) break
  }
  return out
}

function genAttachmentId() {
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

async function addAttachment(file, setAttachments) {
  const id = genAttachmentId()
  if (file.type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file)
    const base64 = dataUrl.split(',')[1] || ''
    setAttachments((a) => [...a, { id, name: file.name, kind: 'image', dataUrl, base64 }])
  } else {
    const text = (await file.text()).slice(0, 20000)
    setAttachments((a) => [...a, { id, name: file.name, kind: 'text', text }])
  }
}

function handleStreamLine(line, onDelta) {
  const l = line.trim()
  if (!l) return false
  try {
    const parsed = parseStreamLine(l)
    if (parsed.delta) onDelta(parsed.delta)
    return parsed.done
  } catch {
    return false
  }
}

async function readChatStream(res, onDelta) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    buf += decoder.decode(value, { stream: !done })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (handleStreamLine(line, onDelta)) return
    }
    if (done) {
      handleStreamLine(buf, onDelta) // dernière ligne éventuelle sans newline final
      return
    }
  }
}

export default function App() {
  const init = useRef(null)
  if (!init.current) {
    const convs = loadConversations()
    const savedActive = loadJSON(LS_ACTIVE, null)
    const activeId0 = savedActive && convs.some((c) => c.id === savedActive) ? savedActive : convs[0].id
    init.current = { convs, activeId0 }
  }

  const [settings, setSettings] = useState(loadSettings)
  const [conversations, setConversations] = useState(init.current.convs)
  const [activeId, setActiveId] = useState(init.current.activeId0)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('unknown')
  const [error, setError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => (globalThis.innerWidth || 1200) > 1024)
  const [theme, setTheme] = useState(loadTheme)

  const scrollRef = useRef(null)
  const ctrlRef = useRef(null)
  const deltaBufRef = useRef('') // buffer de tokens (flush par frame)
  const rafRef = useRef(0)
  const activeIdRef = useRef(activeId); activeIdRef.current = activeId
  const settingsRef = useRef(settings); settingsRef.current = settings
  const conversationsRef = useRef(conversations); conversationsRef.current = conversations

  const active = conversations.find((c) => c.id === activeId) || conversations[0]
  const messages = active ? active.messages : []
  const lastUserMessage = lastUserText(messages)

  useEffect(() => { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem(LS_ACTIVE, activeId) }, [activeId])
  useEffect(() => { localStorage.setItem(LS_THEME, theme) }, [theme])
  useEffect(() => {
    const persist = () => {
      const clean = conversations.map((c) => ({
        ...c,
        messages: c.messages.map(({ role, content, attachments }) =>
          attachments ? { role, content, attachments } : { role, content }),
      }))
      localStorage.setItem(LS_CONVS, JSON.stringify(clean))
    }
    // Pendant le streaming : debounce (évite une écriture par token).
    if (streaming) {
      const t = setTimeout(persist, 400)
      return () => clearTimeout(t)
    }
    persist()
  }, [conversations, streaming])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  const checkConnection = useCallback(async () => {
    setStatus('checking')
    try {
      const req = buildHealthRequest({ baseUrl: settingsRef.current.baseUrl })
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(req.url, { ...req.init, signal: ctrl.signal })
      clearTimeout(timer)
      setStatus(res.ok ? 'connected' : 'disconnected')
    } catch {
      setStatus('disconnected')
    }
  }, [])

  useEffect(() => { checkConnection() }, [checkConnection])

  // Warm-up : charge le modèle au lancement pour réduire le délai avant le 1er token.
  useEffect(() => {
    try {
      const req = buildWarmupRequest({ baseUrl: settingsRef.current.baseUrl, model: settingsRef.current.model })
      fetch(req.url, req.init).catch(() => { /* best-effort */ })
    } catch { /* ignore */ }
  }, [])

  function friendlyError(err) {
    const s = settingsRef.current
    const where = s.baseUrl ? `à l'adresse ${s.baseUrl}` : 'via le proxy local (→ serveur d\'inférence)'
    if (err && err.name === 'TypeError') {
      const proxyHint = s.baseUrl
        ? " Astuce : laisse le champ « URL de l'API » VIDE dans les Réglages pour passer par le proxy intégré (plus stable pour le streaming, sans CORS)."
        : ''
      return (
        `Impossible de joindre le serveur d'inférence ${where} (ou connexion interrompue en cours de réponse). ` +
        "Vérifie qu'il tourne et que l'URL est correcte." + proxyHint
      )
    }
    if (err && /^HTTP\s/.test(err.message || '')) {
      return `Le serveur a rejeté la requête (${err.message}). Vérifie que le modèle « ${s.model} » existe bien sur le serveur.`
    }
    return 'Échec de la requête : ' + ((err && err.message) || 'erreur inconnue') + '.'
  }

  const updateActive = useCallback((updater) => {
    const id = activeIdRef.current
    setConversations((prev) => prev.map((c) => {
      if (c.id !== id) return c
      const msgs = typeof updater === 'function' ? updater(c.messages) : updater
      const title = c.title && c.title !== 'Nouvelle conversation' ? c.title : deriveTitle(msgs, c.title)
      return { ...c, messages: msgs, title, updatedAt: nowTs() }
    }))
  }, [])

  const onAttach = useCallback((files) => {
    files.forEach((file) => { addAttachment(file, setAttachments) })
  }, [])

  const removeAttachment = useCallback((id) => {
    setAttachments((a) => a.filter((x) => x.id !== id))
  }, [])

  // Buffer de tokens rendu une fois par frame (rAF) — évite un re-render par token.
  function flushDelta() {
    rafRef.current = 0
    const chunk = deltaBufRef.current
    if (!chunk) return
    deltaBufRef.current = ''
    updateActive((msgs) => {
      const out = msgs.slice()
      for (let j = out.length - 1; j >= 0; j--) {
        if (out[j].streaming) { out[j] = { ...out[j], content: out[j].content + chunk }; break }
      }
      return out
    })
  }

  function appendDelta(delta) {
    deltaBufRef.current += delta
    if (!rafRef.current) rafRef.current = requestAnimationFrame(flushDelta)
  }

  // Streaming partagé par envoi/régénération (`base` finit par un message user).
  const streamChat = useCallback(async (base, images) => {
    const s = settingsRef.current
    setError(null)
    setStreaming(true)
    updateActive([...base, { role: 'assistant', content: '', streaming: true }])

    const windowed = windowMessages(base, HISTORY_MAX_CHARS)
    const wire = [{ role: 'system', content: s.systemPrompt }]
      .concat(windowed.map((m) => ({ role: m.role, content: m.content })))
    if (images && images.length) wire[wire.length - 1] = { ...wire[wire.length - 1], images }

    const req = buildChatRequest({ baseUrl: s.baseUrl, model: s.model, messages: wire, temperature: s.temperature, maxTokens: s.maxTokens })
    const ctrl = new AbortController()
    ctrlRef.current = ctrl

    try {
      const res = await fetch(req.url, { ...req.init, signal: ctrl.signal })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      if (!res.body) throw new Error('Pas de flux de réponse du serveur')
      await readChatStream(res, appendDelta)
      setStatus('connected')
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // arrêt utilisateur — on garde ce qui a déjà été streamé
      } else {
        setError(friendlyError(err))
        setStatus(err && err.name === 'TypeError' ? 'disconnected' : 'connected')
      }
    } finally {
      ctrlRef.current = null
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      const tail = deltaBufRef.current
      deltaBufRef.current = ''
      setStreaming(false)
      updateActive((msgs) => {
        const out = msgs.slice()
        for (let j = out.length - 1; j >= 0; j--) {
          if (out[j].streaming) {
            const content = out[j].content + tail
            if (!content) out.splice(j, 1)
            else out[j] = { ...out[j], content, streaming: false }
            break
          }
        }
        return out
      })
    }
  }, [updateActive])

  const send = useCallback((text) => {
    const typed = (text != null ? text : input).trim()
    const atts = attachments
    if ((!typed && atts.length === 0) || streaming) return

    const prior = (conversationsRef.current.find((c) => c.id === activeIdRef.current)?.messages) || []
    let composed = typed
    for (const a of atts.filter((x) => x.kind === 'text')) {
      composed += `\n\n--- Fichier joint : ${a.name} ---\n${a.text}`
    }
    const images = atts.filter((x) => x.kind === 'image').map((x) => x.base64)
    const attMeta = atts.map((x) => ({ name: x.name, kind: x.kind }))
    const userMsg = {
      role: 'user',
      content: composed || '(pièces jointes)',
      ...(attMeta.length ? { attachments: attMeta } : {}),
    }

    setInput('')
    setAttachments([])
    streamChat([...prior, userMsg], images)
  }, [input, attachments, streaming, streamChat])

  const regenerate = useCallback((index) => {
    if (streaming) return
    const msgs = conversationsRef.current.find((c) => c.id === activeIdRef.current)?.messages || []
    const base = msgs.slice(0, index)
    if (!base.length || base[base.length - 1].role !== 'user') return
    streamChat(base, null)
  }, [streaming, streamChat])

  const stop = useCallback(() => { if (ctrlRef.current) ctrlRef.current.abort() }, [])

  const newConversation = useCallback(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    setStreaming(false); setError(null); setInput(''); setAttachments([])
    if (globalThis.innerWidth <= 1024) setSidebarOpen(false)
    const prev = conversationsRef.current
    const empty = prev.find((c) => c.messages.length === 0)
    if (empty) { setActiveId(empty.id); return }
    const conv = freshConversation()
    setConversations([conv, ...prev])
    setActiveId(conv.id)
  }, [])

  const selectConversation = useCallback((id) => {
    if (globalThis.innerWidth <= 1024) setSidebarOpen(false)
    if (id === activeIdRef.current) return
    if (ctrlRef.current) ctrlRef.current.abort()
    setStreaming(false); setError(null); setInput(''); setAttachments([])
    setActiveId(id)
  }, [])

  const deleteConversation = useCallback((id) => {
    if (ctrlRef.current && id === activeIdRef.current) ctrlRef.current.abort()
    const next = conversationsRef.current.filter((c) => c.id !== id)
    if (next.length === 0) {
      const conv = freshConversation()
      setConversations([conv])
      setActiveId(conv.id)
      return
    }
    setConversations(next)
    if (id === activeIdRef.current) setActiveId(next[0].id)
  }, [])

  const saveSettings = useCallback((draft) => {
    setSettings({
      __v: SETTINGS_VERSION,
      baseUrl: '', // toujours via le proxy (URL configurée côté code/.env)
      model: (draft.model || '').trim() || 'phi3.5-financial',
      temperature: draft.temperature,
      maxTokens: Math.max(128, Number.parseInt(draft.maxTokens, 10) || 2048),
      systemPrompt: draft.systemPrompt,
      systemPromptCustom: draft.systemPrompt !== DEFAULT_SETTINGS.systemPrompt,
    })
    setSettingsOpen(false)
    setError(null)
    setTimeout(() => checkConnection(), 0)
  }, [checkConnection])

  const canSend = !streaming && (input.trim().length > 0 || attachments.length > 0)

  return (
    <div className="app" data-theme={theme}>
      <Sidebar
        brandName={BRAND}
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="workspace">
        <Header
          title={active?.title || BRAND}
          status={status}
          onRecheck={checkConnection}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
        />

        <MessageList
          scrollRef={scrollRef}
          messages={messages}
          suggestions={SUGGESTIONS}
          onPick={(t) => send(t)}
          error={error}
          onRegenerate={regenerate}
        />

        <Composer
          input={input}
          streaming={streaming}
          canSend={canSend}
          model={settings.model}
          attachments={attachments}
          onAttach={onAttach}
          onRemoveAttachment={removeAttachment}
          onInput={setInput}
          onSend={() => send()}
          onStop={stop}
          onOpenSettings={() => setSettingsOpen(true)}
          lastUserMessage={lastUserMessage}
        />
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  )
}
