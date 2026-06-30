/*
 * Adaptateur backend — seul endroit qui connaît le format réseau (Ollama, NDJSON).
 * baseUrl vide ("") → requêtes same-origin relayées par le proxy Vite (pas de CORS).
 */

export const backendName = 'Ollama'

export function buildChatRequest(cfg) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '')
  return {
    url: base + '/api/chat',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: cfg.messages,
        stream: true,
        // num_predict borne la génération (concision = rapidité) ; num_ctx borne le contexte (prefill rapide).
        options: { temperature: cfg.temperature, num_predict: cfg.maxTokens, num_ctx: 8192 },
      }),
    },
  }
}

// Ollama émet un objet JSON par ligne : { message: { content }, done }.
export function parseStreamLine(line) {
  const data = JSON.parse(line)
  return {
    delta: (data.message && data.message.content) || '',
    done: !!data.done,
  }
}

export function buildHealthRequest(cfg) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '')
  return { url: base + '/api/tags', init: { method: 'GET' } }
}

// Warm-up : keep_alive -1 garde le modèle chaud côté serveur → réduit le délai avant le 1er token.
export function buildWarmupRequest(cfg) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '')
  return {
    url: base + '/api/generate',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, prompt: '', stream: false, keep_alive: -1 }),
    },
  }
}
