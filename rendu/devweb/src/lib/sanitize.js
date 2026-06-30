/*
 * Sanitiseur HTML — défense en profondeur (seconde barrière après l'échappement
 * de markdown.js). Reconstruit le DOM hors-ligne et supprime tout nœud/attribut
 * hors liste blanche : ni script, ni handler on*, ni URL dangereuse ne passent.
 */

// Balises autorisées → attributs autorisés pour chacune.
const ALLOWED = {
  P: ['class'], BR: [], STRONG: [], EM: [], CODE: ['class'], PRE: ['class'],
  UL: ['class'], OL: ['class'], LI: [], A: ['class', 'href', 'target', 'rel'],
  BLOCKQUOTE: ['class'], DIV: ['class'], SPAN: ['class'],
  BUTTON: ['class', 'type', 'aria-label'],
}

function clean(node, doc) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue }

    const tag = child.tagName.toUpperCase()
    const allowedAttrs = ALLOWED[tag]

    // Balise non autorisée → on la remplace par son texte (neutralise toute injection).
    if (!allowedAttrs) {
      child.replaceWith(doc.createTextNode(child.textContent || ''))
      continue
    }

    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || !allowedAttrs.includes(name)) {
        child.removeAttribute(attr.name)
        continue
      }
      if (name === 'href') {
        const v = (attr.value || '').trim().toLowerCase()
        if (!v.startsWith('http://') && !v.startsWith('https://')) child.removeAttribute('href')
      }
    }
    clean(child, doc)
  }
  return node
}

export function sanitizeHtml(html) {
  try {
    const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html')
    const root = doc.body.firstChild
    clean(root, doc)
    return root.innerHTML
  } catch {
    // En cas d'échec improbable, on retombe sur une version texte sûre.
    return String(html).replace(/<[^>]*>/g, '')
  }
}
