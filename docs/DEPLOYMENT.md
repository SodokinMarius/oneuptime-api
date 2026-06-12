# Guide de déploiement — OneUptime (Backend + Frontend)

Déploiement sur VPS KeepSec avec Docker (API) et Nginx (frontend statique + reverse proxy).

**Domaine exemple :** `devtest01-yao-5784.vps.keepsec.cloud`  
**IP exemple :** `166.0.147.111`

---

## 1. Architecture sur le VPS

```
/oneuptime/
├── certs/                 # Certificats TLS (fullchain.pem, privkey.pem)
├── frontend/              # Code source React (git clone)
├── frontend-dist/         # Build prod servi par Nginx (index.html, assets/)
└── oneuptime-api/         # Backend Django + Docker Compose
    ├── .env
    ├── Dockerfile
    └── docker/
        ├── docker-compose.prod.yml
        └── nginx.conf
```

**Flux des requêtes :**

```
Internet (443)
    │
    ▼
[Nginx — conteneur oneuptime-nginx-prod]
    ├── /              → /oneuptime/frontend-dist/  (React)
    ├── /api/v1/       → Django/Gunicorn
    ├── /scim/         → Django
    └── /static/       → fichiers statiques Django
```

---

## 2. Prérequis VPS

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Reconnectez-vous en SSH

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Node.js 22+ (si build frontend sur le VPS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Ports à ouvrir chez KeepSec :** TCP 80 et 443 entrants (via panel ou support).

---

## 3. Déploiement initial — Backend (API)

### 3.1 Cloner le repo

```bash
mkdir -p /oneuptime
cd /oneuptime
git clone git@github.com:SodokinMarius/oneuptime-api.git oneuptime-api
cd oneuptime-api
```

### 3.2 Créer le fichier `.env`

```bash
cp .env.exemple .env
nano .env
```

Variables essentielles :

```env
DJANGO_SECRET_KEY=<générer avec: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=devtest01-yao-5784.vps.keepsec.cloud,166.0.147.111

POSTGRES_DB=oneuptime
POSTGRES_USER=oneuptime
POSTGRES_PASSWORD=<mot_de_passe_fort>
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgres://oneuptime:<mot_de_passe_encode>@db:5432/oneuptime

REDIS_URL=redis://redis:6379/0

FRONTEND_URL=https://devtest01-yao-5784.vps.keepsec.cloud
API_BASE_URL=https://devtest01-yao-5784.vps.keepsec.cloud
CORS_ALLOWED_ORIGINS=https://devtest01-yao-5784.vps.keepsec.cloud

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=votre@gmail.com
EMAIL_HOST_PASSWORD=<mot_de_passe_application_gmail_sans_guillemets>

GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=30
```

> Si le mot de passe Postgres contient `*`, encodez-le dans `DATABASE_URL` (`*` → `%2A`).

### 3.3 Certificats TLS

```bash
mkdir -p /oneuptime/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /oneuptime/certs/privkey.pem \
  -out /oneuptime/certs/fullchain.pem \
  -subj "/CN=devtest01-yao-5784.vps.keepsec.cloud"

docker volume create oneuptime_certs_prod 2>/dev/null || true
docker run --rm \
  -v oneuptime_certs_prod:/certs \
  -v /oneuptime/certs:/src:ro \
  alpine sh -c "cp /src/fullchain.pem /src/privkey.pem /certs/"
```

### 3.4 Vérifier `docker-compose.prod.yml` (volume frontend)

Dans `docker/docker-compose.prod.yml`, section `nginx` → `volumes` :

```yaml
volumes:
  - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
  - static_prod:/app/staticfiles:ro
  - certs_prod:/etc/nginx/certs:ro
  - /oneuptime/frontend-dist:/app/frontend:ro
```

### 3.5 Lancer la stack

```bash
cd /oneuptime/oneuptime-api

docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build
```

Attendre 2–3 minutes au premier build.

### 3.6 Créer un admin

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml exec web \
  python manage.py createsuperuser
```

### 3.7 Vérifier l'API

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml ps
curl -k https://127.0.0.1/nginx-health
curl -k -I -H "Host: devtest01-yao-5784.vps.keepsec.cloud" https://127.0.0.1/api/v1/docs
```

---

## 4. Déploiement initial — Frontend

### 4.1 Cloner le repo frontend

```bash
cd /oneuptime
git clone git@github.com:SodokinMarius/oneuptime-frontend.git frontend
```

*(Ou copier le code depuis votre PC.)*

### 4.2 Builder le frontend

**Option A — Sur votre PC (recommandé si Node 22 absent sur le VPS) :**

```bash
cd Frontend/
npm install
npm run build
rsync -avz --delete dist/ devtest01yao@166.0.147.111:/oneuptime/frontend-dist/
```

**Option B — Sur le VPS (Node.js 22+) :**

```bash
cd /oneuptime/frontend
npm install
npm run build
sudo mkdir -p /oneuptime/frontend-dist
sudo rsync -av --delete dist/ /oneuptime/frontend-dist/
```

### 4.3 Vérifier `nginx.conf`

Le fichier `docker/nginx.conf` doit contenir :

```nginx
location /api/ { proxy_pass http://django; ... }
location /scim/ { proxy_pass http://django; ... }
location / {
    root /app/frontend;
    try_files $uri $uri/ /index.html;
}
```

**Ne pas** laisser `location / { proxy_pass http://django; }` — cela provoque un 404 sur le frontend.

Recharger Nginx :

```bash
cd /oneuptime/oneuptime-api
docker exec oneuptime-nginx-prod nginx -t
docker exec oneuptime-nginx-prod nginx -s reload
```

### 4.4 Vérifier le frontend

```bash
docker exec oneuptime-nginx-prod ls -la /app/frontend/
curl -k -I -H "Host: devtest01-yao-5784.vps.keepsec.cloud" https://127.0.0.1/
```

Attendu : **HTTP/2 200** (sans en-tête `x-ratelimit-limit`).

---

## 5. URLs d'accès

| Ressource | URL |
|-----------|-----|
| Frontend (login) | https://devtest01-yao-5784.vps.keepsec.cloud/ |
| Inscription | https://devtest01-yao-5784.vps.keepsec.cloud/register |
| API Swagger | https://devtest01-yao-5784.vps.keepsec.cloud/api/v1/docs |
| Health check | https://devtest01-yao-5784.vps.keepsec.cloud/nginx-health |

---

## 6. Redéploiement — Backend (API)

À exécuter après modification du code backend sur GitHub.

```bash
cd /oneuptime/oneuptime-api

# 1. Récupérer le code
git pull origin main

# 2. Rebuild et redémarrer (sans supprimer la base)
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build

# 3. Vérifier
docker compose --env-file .env -f docker/docker-compose.prod.yml ps
docker compose --env-file .env -f docker/docker-compose.prod.yml logs web --tail 30
curl -k -I -H "Host: devtest01-yao-5784.vps.keepsec.cloud" https://127.0.0.1/api/v1/docs
```

### Redéploiement backend — changement `.env` uniquement

```bash
cd /oneuptime/oneuptime-api
nano .env
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --force-recreate web scheduler
```

### Redéploiement backend — reset complet (⚠️ efface la base)

```bash
cd /oneuptime/oneuptime-api
docker compose --env-file .env -f docker/docker-compose.prod.yml down -v
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build
# Recopier les certificats TLS (voir section 3.3)
docker compose --env-file .env -f docker/docker-compose.prod.yml exec web python manage.py createsuperuser
```

---

## 7. Redéploiement — Frontend

À exécuter après modification du code frontend sur GitHub.

**Sur le VPS :**

```bash
cd /oneuptime/frontend
git pull origin main
npm install
npm run build
sudo rsync -av --delete dist/ /oneuptime/frontend-dist/
```

Pas besoin de redémarrer Docker — Nginx sert les nouveaux fichiers immédiatement.

**Depuis votre PC (alternative) :**

```bash
cd Frontend/
npm run build
rsync -avz --delete dist/ devtest01yao@166.0.147.111:/oneuptime/frontend-dist/
```

### Redéploiement frontend — si `nginx.conf` a changé

```bash
cd /oneuptime/oneuptime-api
git pull origin main
docker exec oneuptime-nginx-prod nginx -t
docker exec oneuptime-nginx-prod nginx -s reload
```

---

## 8. Redéploiement complet (backend + frontend)

```bash
# ─── Backend ───
cd /oneuptime/oneuptime-api
git pull origin main
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build

# ─── Frontend ───
cd /oneuptime/frontend
git pull origin main
npm install
npm run build
sudo rsync -av --delete dist/ /oneuptime/frontend-dist/

# ─── Vérifications ───
docker compose --env-file .env -f docker/docker-compose.prod.yml ps
curl -k -I -H "Host: devtest01-yao-5784.vps.keepsec.cloud" https://127.0.0.1/
curl -k -I -H "Host: devtest01-yao-5784.vps.keepsec.cloud" https://127.0.0.1/api/v1/docs
```

---

## 9. Commandes utiles

### Logs

```bash
cd /oneuptime/oneuptime-api

# API Django
docker compose --env-file .env -f docker/docker-compose.prod.yml logs -f web

# Nginx
docker compose --env-file .env -f docker/docker-compose.prod.yml logs -f nginx

# Tous les services
docker compose --env-file .env -f docker/docker-compose.prod.yml logs -f
```

### État des conteneurs

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml ps
```

### Tester l'email SMTP

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml exec web \
  python manage.py send_test_email votre@gmail.com
```

### Sauvegarde base de données

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml exec db \
  pg_dump -U oneuptime oneuptime > backup_$(date +%Y%m%d).sql
```

---

## 10. Dépannage rapide

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Nginx `Restarting` | Certificats TLS manquants | Section 3.3 |
| 502 sur `/api/` | API crash (DB, Redis) | `logs web` |
| 404 sur `/` avec `x-ratelimit` | `nginx.conf` envoie `/` à Django | Mettre `root /app/frontend` |
| `/app/frontend/` absent | Volume non monté | Vérifier `docker-compose.prod.yml` + recréer nginx |
| 500 à l'inscription | Email SMTP | `logs web`, vérifier Gmail app password |
| `TemplateDoesNotExist` | `templates/` absent du Docker | Rebuild avec `COPY templates/` dans Dockerfile |
| Timeout externe | Firewall KeepSec | Ouvrir ports 80/443 |
| `tsc: not found` / Node 18 | Node trop vieux | Node 22+ ou build sur PC |

### Vérifications express

```bash
# Frontend monté ?
docker exec oneuptime-nginx-prod ls /app/frontend/index.html

# nginx.conf correct ?
docker exec oneuptime-nginx-prod grep -A2 "location / {" /etc/nginx/conf.d/default.conf

# Montages Docker
docker compose --env-file .env -f docker/docker-compose.prod.yml config | grep frontend
```

---

## 11. Checklist premier déploiement

- [ ] Docker installé, ports 80/443 ouverts
- [ ] `/oneuptime/oneuptime-api/.env` configuré
- [ ] Certificats TLS dans volume `oneuptime_certs_prod`
- [ ] `docker compose up -d --build` — tous les conteneurs `Up`
- [ ] `/oneuptime/frontend-dist/index.html` existe
- [ ] Volume frontend monté dans nginx (`docker compose config | grep frontend`)
- [ ] `nginx.conf` : `location /` → `root /app/frontend`
- [ ] `curl https://127.0.0.1/` → HTTP 200
- [ ] `curl .../api/v1/docs` → HTTP 200
- [ ] Navigateur → page de login

---

## 12. Repos GitHub

| Projet | Repo |
|--------|------|
| Backend | `git@github.com:SodokinMarius/oneuptime-api.git` |
| Frontend | `git@github.com:SodokinMarius/oneuptime-frontend.git` |
