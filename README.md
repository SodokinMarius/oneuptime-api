# OneUptime API

API Django REST pour la plateforme OneUptime (monitors, incidents, SSO, webhooks, etc.).

## Stack

- **Python 3.10** · **Django** · **DRF** · **PostgreSQL** · **Redis**
- **Gunicorn** en production · **Docker Compose** pour le déploiement VPS

## Développement local

```bash
cp .env.exemple .env
# Éditer .env (DJANGO_SECRET_KEY, POSTGRES_PASSWORD…)

make db-up          # PostgreSQL + API en Docker
make migrate
make run            # ou utiliser le conteneur web
```

API locale : http://localhost:8000/api/v1/docs

## Déploiement production (VPS)

Guide complet : **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

### Premier déploiement (résumé)

```bash
cd /oneuptime/oneuptime-api
cp .env.exemple .env && nano .env
# Certificats TLS → voir docs/DEPLOYMENT.md

docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker/docker-compose.prod.yml exec web python manage.py createsuperuser
```

### Redéploiement API

```bash
cd /oneuptime/oneuptime-api
git pull origin main
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build
```

## Structure VPS recommandée

```
/oneuptime/
├── oneuptime-api/      ← ce repo (backend + Docker)
├── frontend/           ← repo React
├── frontend-dist/      ← build servi par Nginx
└── certs/              ← certificats TLS
```

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Déploiement backend + frontend, redéploiement, dépannage |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Référence API |
| [docs/SSO_GUIDE.md](docs/SSO_GUIDE.md) | Configuration SSO/SAML |

## Commandes utiles

```bash
make help
make docker-logs
make test
```
