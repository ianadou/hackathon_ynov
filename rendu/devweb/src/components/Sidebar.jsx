import { useState } from 'react'
import PhiGlyph from './PhiGlyph.jsx'
import { IconPlus, IconChat, IconTrash, IconSearch, IconPanelLeft, IconSettings, IconSun, IconMoon } from './icons.jsx'

function formatDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function Sidebar({ brandName, conversations, activeId, onSelect, onNew, onDelete, open, onClose, theme, onToggleTheme, onOpenSettings }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const filtered = query
    ? conversations.filter((c) => (c.title || '').toLowerCase().includes(query))
    : conversations

  return (
    <>
      <aside className={'sidebar' + (open ? ' sidebar--open' : ' sidebar--closed')} aria-label="Historique des conversations">
        <div className="sidebar__brand">
          <div className="brand__logo brand__logo--sm"><PhiGlyph /></div>
          <span className="sidebar__brandname">{brandName}</span>
          <button type="button" className="sidebar__collapse" onClick={onClose} title="Replier le menu" aria-label="Replier le menu">
            <IconPanelLeft />
          </button>
        </div>

        <button type="button" className="sidebar__new" onClick={onNew}>
          <IconPlus />
          <span>Nouvelle conversation</span>
        </button>

        <div className="sidebar__search">
          <IconSearch className="sidebar__searchicon" />
          <input
            className="sidebar__searchinput"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            spellCheck={false}
            aria-label="Rechercher une conversation"
          />
        </div>

        <div className="sidebar__label">Historique</div>

        <nav className="sidebar__list scroll">
          {filtered.length === 0 && (
            <div className="sidebar__empty">{query ? 'Aucun résultat.' : 'Aucune conversation.'}</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={'conv' + (c.id === activeId ? ' conv--active' : '')}
              onClick={() => onSelect(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.id) } }}
              title={c.title || 'Nouvelle conversation'}
            >
              <span className="conv__icon"><IconChat /></span>
              <span className="conv__main">
                <span className="conv__title">{c.title || 'Nouvelle conversation'}</span>
                <span className="conv__date">{formatDate(c.updatedAt || c.createdAt)}</span>
              </span>
              <button
                type="button"
                className="conv__del"
                onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                title="Supprimer la conversation"
                aria-label="Supprimer la conversation"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button type="button" className="sidebar__foot-btn" onClick={onToggleTheme} title="Basculer le thème">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            <span>{theme === 'dark' ? 'Thème clair' : 'Thème sombre'}</span>
          </button>
          <button type="button" className="sidebar__foot-btn" onClick={onOpenSettings} title="Réglages">
            <IconSettings />
            <span>Réglages</span>
          </button>
        </div>
      </aside>

      {open && <div className="sidebar__scrim" onClick={onClose} aria-hidden="true" />}
    </>
  )
}
