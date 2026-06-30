import { useEffect, useRef, useState } from 'react'
import { IconClose } from './icons.jsx'

export default function SettingsPanel({ open, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings)
  const firstRef = useRef(null)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setTimeout(() => firstRef.current?.focus(), 0)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Réglages">
      <div className="modal__overlay" onClick={onClose} />
      <div className="modal__card">
        <header className="modal__header">
          <h1 className="modal__title">Réglages</h1>
          <button type="button" className="modal__close" onClick={onClose} title="Fermer" aria-label="Fermer">
            <IconClose />
          </button>
        </header>

        <div className="modal__body scroll">
          <div className="field">
            <label className="field__label">Modèle</label>
            <input
              ref={firstRef}
              className="input input--mono"
              value={draft.model}
              onChange={set('model')}
              placeholder="phi3.5-financial"
              spellCheck={false}
            />
            <span className="field__caption">
              Le serveur d'inférence est configuré côté code (proxy <code>/api</code> → <code>.env</code>),
              pas ici : le navigateur reste en same-origin (stable, sans CORS).
            </span>
          </div>

          <div className="field">
            <div className="field__row">
              <label className="field__label">Température</label>
              <span className="field__num">{Number(draft.temperature).toFixed(1)}</span>
            </div>
            <input
              className="range"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={draft.temperature}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: parseFloat(e.target.value) }))}
            />
            <span className="field__caption">Plus bas = plus précis et déterministe, recommandé pour des réponses financières.</span>
          </div>

          <div className="field">
            <label className="field__label">Longueur max de réponse (tokens)</label>
            <input
              className="input input--mono"
              type="number"
              min="128"
              max="8192"
              step="128"
              value={draft.maxTokens}
              onChange={set('maxTokens')}
            />
            <span className="field__caption">Plafond de génération (num_predict). Évite les réponses tronquées ; plus haut = réponses plus complètes mais plus longues à générer.</span>
          </div>

          <div className="field">
            <label className="field__label">Prompt système</label>
            <textarea
              className="input input--area"
              value={draft.systemPrompt}
              onChange={set('systemPrompt')}
              rows={6}
            />
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--block btn--outline" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn--block btn--primary" onClick={() => onSave(draft)}>Enregistrer</button>
        </footer>
      </div>
    </div>
  )
}
