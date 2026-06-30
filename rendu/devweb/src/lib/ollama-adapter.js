
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
        keep_alive: -1, 
        options: { temperature: cfg.temperature, num_predict: cfg.maxTokens, num_ctx: 4096 },
      }),
    },
  }
}

export function parseStreamLine(line) {
  const data = JSON.parse(line)
  return {
    delta: data.message?.content || '',
    done: !!data.done,
  }
}

export function buildHealthRequest(cfg) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '')
  return { url: base + '/api/tags', init: { method: 'GET' } }
}

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
