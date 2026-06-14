# OneUptime Frontend

Interface React (Vite + TypeScript + Tailwind) pour la plateforme OneUptime.

## Prérequis

- **Node.js 20.19+** ou **22.12+** (requis par Vite)
- API backend accessible sur `/api/v1` (même domaine en production)

## Développement local

```bash
npm install
npm run dev
```

Application : http://localhost:3000  
Les appels `/api` sont proxifiés vers http://localhost:8000 (voir `vite.config.ts`).

**Backend requis :** lancer l’API Django en parallèle (`make db-up` dans `oneuptime-api`).

## Configuration

Fichiers d’environnement Vite :

| Fichier | Usage |
|---------|--------|
| `.env.development` | Dev local (`VITE_API_BASE_URL=/api/v1`) |
| `.env.production` | Build prod (`VITE_API_BASE_URL=/api/v1`) |

En production, frontend et API partagent le **même domaine** via Nginx — pas d’URL absolue nécessaire.

## Build production

```bash
npm run build
```

Sortie : dossier `dist/` (`index.html`, `assets/`…)

## Déploiement sur le VPS

Le frontend est servi en **fichiers statiques** par Nginx (conteneur du backend).  
Guide complet : [oneuptime-api/docs/DEPLOYMENT.md](https://github.com/SodokinMarius/oneuptime-api/blob/main/docs/DEPLOYMENT.md)

### Structure sur le serveur

```
/oneuptime/
├── frontend/           ← ce repo (git clone)
├── frontend-dist/      ← contenu de dist/ (servi par Nginx)
└── oneuptime-api/      ← backend + docker-compose
```

### Premier déploiement (résumé)

```bash
# Sur le VPS
cd /oneuptime
git clone git@github.com:SodokinMarius/oneuptime-frontend.git frontend
cd frontend && npm install && npm run build
sudo rsync -av --delete dist/ /oneuptime/frontend-dist/
```

Configurer Nginx dans `oneuptime-api` (volume + `nginx.conf`) — voir guide de déploiement.

### Redéploiement frontend

```bash
cd /oneuptime/frontend
git pull origin main
npm install
npm run build
sudo rsync -av --delete dist/ /oneuptime/frontend-dist/
```

Pas besoin de redémarrer Docker après un simple rebuild frontend.

**Alternative — build sur votre PC :**

```bash
npm run build
rsync -avz --delete dist/ user@vps:/oneuptime/frontend-dist/
```

## URLs production (exemple)

| Page | URL |
|------|-----|
| Login | `https://votre-domaine/` |
| Inscription | `https://votre-domaine/register` |
| API docs | `https://votre-domaine/api/v1/docs` |

## Scripts

```bash
npm run dev      # Serveur de développement
npm run build    # Build production
npm run preview  # Prévisualiser le build localement
npm run lint     # ESLint
```
