import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Le navigateur ne parle JAMAIS directement au serveur d'inférence : il appelle
 * /api/* en same-origin, et Vite proxifie ces requêtes vers l'URL configurée.
 * => Zéro configuration CORS, et l'URL réelle ne quitte pas le serveur de dev.
 *
 * L'URL est lue depuis le fichier .env (clé INFERENCE_URL, ou OLLAMA_URL en repli) :
 *   INFERENCE_URL=http://localhost:11434
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const INFERENCE_URL = env.INFERENCE_URL || env.OLLAMA_URL || 'http://localhost:11434'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true, // accessible sur le réseau local (utile pour la démo)
      proxy: {
        '/api': {
          target: INFERENCE_URL,
          changeOrigin: true,
          secure: true, // l'upstream HTTPS a un certificat valide
        },
      },
    },
  }
})
