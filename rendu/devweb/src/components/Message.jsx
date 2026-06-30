import { memo, useState } from 'react'
import { renderMarkdown } from '../lib/markdown.js'
import { sanitizeHtml } from '../lib/sanitize.js'
import { IconCopy, IconCheck, IconFile } from './icons.jsx'

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="msg msg--user">
        <div className="msg__usercol">
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="bubble__atts">
              {msg.attachments.map((a, i) => (
                <span key={i} className="att-chip" title={a.name}>
                  <IconFile className="att-chip__icon" />
                  <span className="att-chip__name">{a.name}</span>
                </span>
              ))}
            </div>
          )}
          {msg.content && <div className="bubble">{stripFileDump(msg.content)}</div>}
        </div>
      </div>
    )
  }
  return <AssistantMessage msg={msg} />
}

export default memo(Message)

// N'affiche pas le contenu brut des fichiers injectés dans la bulle utilisateur.
function stripFileDump(content) {
  const idx = content.indexOf('\n\n--- Fichier joint :')
  return idx >= 0 ? content.slice(0, idx) : content
}

function AssistantMessage({ msg }) {
  const [copied, setCopied] = useState(false)

  // Indicateur "typing" tant que rien n'est arrivé.
  if (msg.streaming && !msg.content) {
    return (
      <div className="msg msg--assistant">
        <div className="msg__avatar"><PhiAvatar /></div>
        <div className="msg__body">
          <div className="typing">
            <span className="typing__dot" />
            <span className="typing__dot" />
            <span className="typing__dot" />
          </div>
        </div>
      </div>
    )
  }

  if (msg.streaming) {
    const html = renderMarkdown(msg.content) + '<span class="stream-cursor"></span>'
    return (
      <div className="msg msg--assistant">
        <div className="msg__avatar"><PhiAvatar /></div>
        <div className="msg__body prose" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    )
  }

  const html = sanitizeHtml(renderMarkdown(msg.content))

  const copyAll = () => {
    navigator.clipboard?.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  const onBodyClick = (e) => {
    const btn = e.target.closest?.('.md-copy')
    if (!btn) return
    const pre = btn.closest('.md-codeblock')?.querySelector('pre')
    if (!pre) return
    navigator.clipboard?.writeText(pre.innerText).then(() => {
      const prev = btn.textContent
      btn.textContent = 'Copié ✓'
      setTimeout(() => { btn.textContent = prev }, 1400)
    })
  }

  return (
    <div className="msg msg--assistant">
      <div className="msg__avatar"><PhiAvatar /></div>
      <div className="msg__body prose" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
      {msg.content && (
        <button type="button" className="msg__copy" onClick={copyAll} title="Copier la réponse">
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      )}
    </div>
  )
}

function PhiAvatar() {
  return <img src="/atlas-logo.svg" alt="Atlas" width="100%" height="100%" draggable="false" />
}
