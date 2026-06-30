import { IconMenu } from './icons.jsx'

const STATUS_META = {
  connected:    { label: 'Connecté',   color: 'var(--success)',  pulse: false },
  checking:     { label: 'Connexion…', color: 'var(--warn)',     pulse: true  },
  disconnected: { label: 'Hors ligne', color: 'var(--danger)',   pulse: false },
  unknown:      { label: 'Inconnu',    color: 'var(--fg-muted)', pulse: false },
}

export default function Header({ title, status, onRecheck, onToggleSidebar, sidebarOpen }) {
  const meta = STATUS_META[status] || STATUS_META.unknown

  return (
    <header className="header">
      {!sidebarOpen && (
        <button type="button" className="ctl ctl--icon header__menu" onClick={onToggleSidebar} title="Afficher le menu" aria-label="Afficher le menu">
          <IconMenu />
        </button>
      )}

      <div className="header__title" title={title}>{title}</div>

      <div className="header__spacer" />

      {/* État du serveur — clic pour revérifier. */}
      <button
        type="button"
        className="status"
        onClick={onRecheck}
        title={`Serveur d'inférence : ${meta.label}. Cliquer pour revérifier.`}
        aria-label={`État du serveur d'inférence : ${meta.label}`}
      >
        <span className="status__dot" style={{ background: meta.color }} />
        <span className="status__label">{meta.label}</span>
      </button>
    </header>
  )
}
