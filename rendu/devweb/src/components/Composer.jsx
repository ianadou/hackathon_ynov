import { useEffect, useRef } from 'react'
import { IconPlus, IconSend, IconStop, IconChip, IconChevron, IconClose, IconFile } from './icons.jsx'

const ACCEPT = 'image/*,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.log,.xml,.yaml,.yml'

export default function Composer({
  input, streaming, canSend, model,
  attachments, onAttach, onRemoveAttachment,
  onInput, onSend, onStop, onOpenSettings, lastUserMessage,
}) {
  const taRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden'
  }, [input])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
      return
    }
    if (e.key === 'ArrowUp' && input === '' && lastUserMessage) {
      e.preventDefault()
      onInput(lastUserMessage)
    }
  }

  const onFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onAttach(files)
    e.target.value = '' // permet de re-sélectionner le même fichier
  }

  return (
    <footer className="composer">
      <div className="composer__inner">
        <div className="composer__box">
          {attachments.length > 0 && (
            <div className="attachments">
              {attachments.map((a) => (
                <div key={a.id} className="chip">
                  {a.kind === 'image' && a.dataUrl
                    ? <img className="chip__thumb" src={a.dataUrl} alt={a.name} />
                    : <span className="chip__icon"><IconFile /></span>}
                  <span className="chip__name">{a.name}</span>
                  <button
                    type="button"
                    className="chip__close"
                    onClick={() => onRemoveAttachment(a.id)}
                    title="Retirer la pièce jointe"
                    aria-label={`Retirer ${a.name}`}
                  >
                    <IconClose />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={taRef}
            className="composer__input"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Phi Financial IA…"
            title="Entrée pour envoyer · Maj+Entrée pour un retour à la ligne"
            rows={1}
            autoFocus
          />

          <div className="composer__toolbar">
            <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={onFiles} hidden />
            <button
              type="button"
              className="ctl ctl--icon"
              onClick={() => fileRef.current?.click()}
              title="Joindre des fichiers ou des images"
              aria-label="Joindre des fichiers ou des images"
            >
              <IconPlus />
            </button>

            <div className="composer__grow" />

            <button type="button" className="ctl ctl--model" onClick={onOpenSettings} title="Modèle & réglages" aria-label="Modèle et réglages">
              <IconChip className="ctl__chip" />
              <span className="ctl__model">{model}</span>
              <IconChevron className="ctl__chevron" />
            </button>

            {streaming ? (
              <button type="button" className="send send--stop" onClick={onStop} title="Arrêter la génération" aria-label="Arrêter la génération">
                <IconStop />
              </button>
            ) : (
              <button type="button" className="send" onClick={onSend} disabled={!canSend} title="Envoyer" aria-label="Envoyer">
                <IconSend />
              </button>
            )}
          </div>
        </div>
        <div className="composer__note">Réponses générées par IA. Vérifie les chiffres importants avant d'agir.</div>
      </div>
    </footer>
  )
}
