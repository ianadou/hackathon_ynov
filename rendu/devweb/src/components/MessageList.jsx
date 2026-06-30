import Message from './Message.jsx'
import PhiGlyph from './PhiGlyph.jsx'
import { IconAlert } from './icons.jsx'

export default function MessageList({ scrollRef, messages, suggestions, onPick, error, onRegenerate }) {
  const isEmpty = messages.length === 0

  return (
    <main ref={scrollRef} className="main scroll">
      <div className="thread">
        {isEmpty && (
          <div className="empty">
            <div className="empty__logo"><PhiGlyph /></div>
            <h1 className="empty__title">Comment puis-je t'aider avec tes finances&#8239;?</h1>
            <p className="empty__sub">
              Pose tes questions sur les marchés, la comptabilité, la valorisation, la fiscalité
              ou la stratégie d'entreprise. Les réponses sont générées par ton modèle auto-hébergé.
            </p>
            <div className="suggestions">
              {suggestions.map((text, i) => (
                <button key={i} type="button" className="suggestion" onClick={() => onPick(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} index={i} onRegenerate={onRegenerate} />
        ))}

        {error && (
          <div className="error">
            <IconAlert className="error__icon" stroke="var(--danger)" />
            <div className="error__text">{error}</div>
          </div>
        )}
      </div>
    </main>
  )
}
