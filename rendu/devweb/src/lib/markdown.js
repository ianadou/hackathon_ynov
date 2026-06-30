/* Rendu markdown minimal, sans dépendance. Émet du HTML à classes md-* (stylé par .prose). */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Neutralise guillemets/apostrophes d'une URL d'attribut (anti-évasion XSS ; & < > déjà gérés par esc()).
const escAttr = (s) => String(s).replace(/"/g, '%22').replace(/'/g, '%27')

// Formatage inline — opère sur du texte déjà échappé.
function inline(t) {
  t = t.replace(/`([^`]+)`/g, (_m, c) => `<code class="md-code">${c}</code>`)
  // liens [texte](url) — schéma restreint à http(s), URL échappée pour l'attribut
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text, url) => `<a class="md-link" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
  return t
}

export function renderMarkdown(src) {
  if (!src) return ''

  const lines = String(src).replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const lang = fence[1] || ''
      i++
      const code = []
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i])
        i++
      }
      i++ // saute la clôture
      const label = lang ? `<span class="md-codeblock__lang">${esc(lang)}</span>` : ''
      html +=
        '<div class="md-codeblock">' +
        '<div class="md-codeblock__bar">' + label +
        '<button type="button" class="md-copy" aria-label="Copier le code">Copier</button>' +
        '</div>' +
        '<pre class="md-pre"><code>' + esc(code.join('\n')) + '</code></pre>' +
        '</div>'
      continue
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length <= 2 ? 'md-h md-h--lg' : 'md-h'
      html += `<div class="${level}">` + inline(esc(h[2])) + '</div>'
      i++
      continue
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr class="md-hr">'
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      html += '<blockquote class="md-quote">' + inline(esc(quote.join(' '))) + '</blockquote>'
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const ul = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        ul.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      html += '<ul class="md-ul">' +
        ul.map((it) => '<li>' + inline(esc(it)) + '</li>').join('') + '</ul>'
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const ol = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        ol.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      html += '<ol class="md-ol">' +
        ol.map((it) => '<li>' + inline(esc(it)) + '</li>').join('') + '</ol>'
      continue
    }

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    const para = [line]
    i++
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    html += '<p class="md-p">' + inline(esc(para.join(' '))) + '</p>'
  }

  return html
}
