# 🌐 Phi Financial IA — Interface web (DEV WEB)

Interface de chat web pour le modèle **Phi-3.5-Financial** de TechCorp.
Streaming temps réel, multi-conversations, thèmes clair/sombre, upload de fichiers,
sécurité renforcée. Logo **Atlas**.

> Rôle **DEV WEB** du Challenge IA 7h. La couche d'inférence (Ollama) est fournie
> par l'équipe **INFRA**. Le front la consomme **uniquement via un proxy**
> (même origine, zéro CORS, URL côté serveur).

---

## 🚀 Lancement

### En dev (Vite)
```bash
cp .env.example .env     # renseigne INFERENCE_URL (ex. http://localhost:11434)
./run.sh                 # = npm install && npm run dev
```
→ http://localhost:5173 — prérequis : **Node.js 18+**.

### En production (Docker)
```bash
cp .env.example .env     # INFERENCE_URL = URL du serveur d'inférence INFRA
docker compose up -d --build
```
→ http://localhost:8080 (nginx sert le build + proxifie `/api`).

---

## 🔌 Configuration de l'API (sécurisée, `.env`)

Le navigateur **n'appelle jamais** le serveur d'inférence directement : il fait
des requêtes same-origin `/api/*`, relayées par un **proxy** (Vite en dev, nginx
en prod). Résultat : **aucun CORS**, et l'URL/credentials restent côté serveur.

L'URL est lue depuis `.env` (non commité) :
```
INFERENCE_URL=http://localhost:11434
```
- Ollama local : `http://localhost:11434`
- Triton : `http://localhost:8000` (adapter le format dans `ollama-adapter.js`)
- Serveur maison : URL communiquée par l'INFRA

---

## ✅ Couverture du cahier des charges DEV WEB

| Exigence | Statut |
|---|---|
| Interface web de chat (obligatoire) | ✅ |
| Intégration de l'API du serveur d'inférence | ✅ via proxy `/api/chat` |
| Interface intuitive pour tester le modèle | ✅ |
| Interface complète et fonctionnelle | ✅ |
| Intégration API **temps réel** | ✅ streaming token-par-token |

### Fonctionnalités
- **Streaming temps réel** (NDJSON Ollama) avec rendu Markdown en direct, buffer de
  tokens (flush par frame) et warm-up du modèle au lancement (réduit le 1er token).
- **Multi-conversations** : historique persistant (localStorage), création, sélection,
  suppression, titres auto, recherche.
- **Rappel du dernier message** via flèche **↑** (champ vide).
- **Upload** de fichiers/images (chips avec ✕) : texte injecté en contexte, images
  via le champ `images` d'Ollama (modèle multimodal).
- **Thèmes** clair / sombre (`#212121`) persistés, motif à pois (canvas).
- **Réglages** : modèle, température, longueur max de réponse, prompt système — tout
  modifiable et persistant. L'URL d'API n'est PAS exposée (configurée côté code).
- **État de connexion** (connecté / hors ligne), bouton stop, responsive tablette/mobile.

---

## 🏗️ Architecture

```
rendu/devweb/
├── .env / .env.example     # INFERENCE_URL (proxy)
├── vite.config.js          # proxy /api → INFERENCE_URL (dev)
├── Dockerfile              # build Vite → nginx
├── nginx.conf.template     # proxy /api + en-têtes de sécurité (prod)
├── docker-compose.yml
└── src/
    ├── App.jsx             # état, streaming, conversations, persistance
    ├── lib/
    │   ├── ollama-adapter.js   # SEULE couche qui connaît le protocole réseau
    │   ├── markdown.js         # rendu markdown sans dépendance
    │   └── sanitize.js         # sanitisation HTML (défense en profondeur)
    └── components/         # Sidebar, Header, MessageList, Message, Composer, SettingsPanel
```

### Changer de backend (Triton, vLLM, serveur maison)
Tout le protocole réseau est isolé dans `src/lib/ollama-adapter.js` (3 fonctions).
Adapter aussi la cible du proxy (`vite.config.js` / `nginx.conf.template`).

---

## 🔒 Sécurité

- **XSS** : le rendu Markdown échappe tout le texte du modèle, restreint les liens
  au schéma `http(s)`, et une passe de **sanitisation par liste blanche** (sans
  dépendance) nettoie le HTML final.
- **Pas de secret côté client** : l'URL d'inférence est dans `.env` (gitignoré) et
  n'est jamais appelée directement par le navigateur (proxy same-origin).
- **En-têtes de sécurité nginx** (prod) : `Content-Security-Policy`, `X-Frame-Options`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Dépendances** : `npm audit --omit=dev` → **0 vulnérabilité** (l'artefact livré
  nginx ne contient que des fichiers statiques).
