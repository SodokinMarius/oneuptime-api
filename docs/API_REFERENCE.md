# OneUptime Backend — Documentation API & État d'implémentation

**Version :** 1.0 | **Date :** Mai 2026 | **Stack :** Django 5.2 + DRF + PostgreSQL

> **Base URL :** `http://localhost:8000/api/v1`
> **Swagger UI :** `http://localhost:8000/api/v1/docs`
> **OpenAPI JSON :** `http://localhost:8000/api/v1/openapi.json`

---

## Authentification

Toutes les requêtes (sauf auth publiques) nécessitent :

```
Authorization: Bearer <access_token>
```

Deux types de tokens acceptés :
- **JWT** — obtenu via `POST /auth/login`
- **API Key** — obtenu via `POST /api-keys`, format `ok_live_xxxxxxxx`

---

## Légende

| Symbole | Signification |
|---------|--------------|
| ✅ | Implémenté et fonctionnel |
| 🟡 | Partiellement implémenté |
| ❌ | Non implémenté |

---

---

# MODULES IMPLÉMENTÉS

---

## 1. Authentification & Comptes (`/api/v1/auth/`)

> Gestion des utilisateurs, JWT, MFA TOTP, reset de mot de passe, invitations.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| POST | `/auth/register` | Créer un compte (User + Tenant + Project atomique) | ✅ |
| POST | `/auth/activate` | Activer le compte avec le code OTP reçu par email | ✅ |
| POST | `/auth/resend-activation` | Renvoyer le code OTP d'activation | ✅ |
| POST | `/auth/login` | Se connecter (retourne JWT ou mfa_token si MFA actif) | ✅ |
| POST | `/auth/refresh` | Renouveler l'access token avec le refresh token | ✅ |
| POST | `/auth/token/verify` | Vérifier qu'un token est valide | ✅ |
| POST | `/auth/logout` | Blacklister le refresh token | ✅ |
| GET | `/auth/me` | Profil de l'utilisateur connecté | ✅ |
| PUT | `/auth/me` | Mettre à jour le profil | ✅ |
| PATCH | `/auth/me` | Mise à jour partielle du profil | ✅ |
| POST | `/auth/change-password` | Changer son mot de passe | ✅ |
| POST | `/auth/password-reset` | Demander un OTP de réinitialisation de mot de passe | ✅ |
| POST | `/auth/password-reset/confirm` | Réinitialiser le mot de passe avec l'OTP | ✅ |
| POST | `/auth/mfa/setup` | Démarrer la configuration TOTP (retourne secret + QR URI) | ✅ |
| POST | `/auth/mfa/confirm` | Confirmer l'activation du MFA | ✅ |
| POST | `/auth/mfa/disable` | Désactiver le MFA (password + code TOTP requis) | ✅ |
| POST | `/auth/mfa/verify-login` | Compléter la connexion après validation TOTP | ✅ |
| POST | `/auth/accept-invite` | Accepter une invitation à rejoindre un tenant | ✅ |
| POST | `/auth/erase-account` | GDPR — pseudonymiser et désactiver son compte | ✅ |

### Gestion des utilisateurs (`/api/v1/users/`)

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/users` | Lister les utilisateurs du tenant | ✅ |
| GET | `/users/:id` | Détails d'un utilisateur | ✅ |
| POST | `/users/invite` | Inviter un utilisateur par email | ✅ |
| POST | `/users/:id/deactivate` | Désactiver un utilisateur | ✅ |

---

## 2. Tenancy — Tenants & Projets (`/api/v1/`)

> Architecture multi-tenant. Chaque tenant peut avoir plusieurs projets.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/projects` | Lister les projets du tenant courant | ✅ |
| POST | `/projects` | Créer un projet | ✅ |
| GET | `/projects/:id` | Détails d'un projet | ✅ |
| PUT | `/projects/:id` | Mettre à jour un projet | ✅ |
| PATCH | `/projects/:id` | Mise à jour partielle | ✅ |
| DELETE | `/projects/:id` | Désactiver un projet (soft delete) | ✅ |
| GET | `/tenants` | Lister tous les tenants *(super-admin)* | ✅ |
| POST | `/tenants` | Créer un tenant *(super-admin)* | ✅ |
| GET | `/tenants/:id` | Détails d'un tenant *(super-admin)* | ✅ |
| PUT | `/tenants/:id` | Modifier un tenant *(super-admin)* | ✅ |
| POST | `/tenants/:id/suspend` | Suspendre un tenant *(super-admin)* | ✅ |
| POST | `/tenants/:id/activate` | Réactiver un tenant *(super-admin)* | ✅ |

> **Headers de contexte :**
> - `X-Tenant-Id: <uuid>` — identifier le tenant
> - `X-Project-Id: <uuid>` — identifier le projet

---

## 3. RBAC — Rôles, Équipes & Permissions (`/api/v1/`)

> Contrôle d'accès basé sur les rôles avec permissions `resource:action`.

### Rôles

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/roles` | Lister les rôles du projet | ✅ |
| POST | `/roles` | Créer un rôle personnalisé | ✅ |
| GET | `/roles/:id` | Détails d'un rôle | ✅ |
| PUT | `/roles/:id` | Modifier les permissions d'un rôle | ✅ |
| DELETE | `/roles/:id` | Supprimer un rôle (interdit pour les rôles système) | ✅ |
| GET | `/roles/permissions` | Lister toutes les permissions disponibles | ✅ |

**Rôles système (non modifiables) :**
- `admin` → `["*"]` (tout)
- `member` → permissions standards (create/read/update sur monitors, incidents…)
- `viewer` → `["*:read"]` (lecture seule)

### Équipes

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/teams` | Lister les équipes | ✅ |
| POST | `/teams` | Créer une équipe | ✅ |
| GET | `/teams/:id` | Détails d'une équipe | ✅ |
| PUT | `/teams/:id` | Modifier une équipe | ✅ |
| DELETE | `/teams/:id` | Supprimer une équipe | ✅ |
| GET | `/teams/:id/members` | Lister les membres | ✅ |
| POST | `/teams/:id/members` | Ajouter un membre | ✅ |
| DELETE | `/teams/:id/members/:uid` | Retirer un membre | ✅ |

### Clés API

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/api-keys` | Lister les clés API du projet | ✅ |
| POST | `/api-keys` | Créer une clé API (retournée une seule fois) | ✅ |
| DELETE | `/api-keys/:id` | Révoquer une clé API | ✅ |

### Politiques de ressources (resource_policy)

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/resource-policies` | Lister les politiques allow/deny | ✅ |
| POST | `/resource-policies` | Créer une politique sur une ressource précise | ✅ |
| PUT | `/resource-policies/:id` | Modifier | ✅ |
| DELETE | `/resource-policies/:id` | Supprimer | ✅ |

> Un `effect: deny` sur un `resource_id` précis écrase tout `allow` venant du rôle.

---

## 4. Monitoring (`/api/v1/`)

> Surveillance de endpoints HTTP, TCP, heartbeat. Checks automatiques toutes les minutes.

### Monitors

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/monitors` | Lister les monitors (filtres: type, status, paused, search) | ✅ |
| POST | `/monitors` | Créer un monitor | ✅ |
| GET | `/monitors/:id` | Détails du monitor + statut courant | ✅ |
| PUT | `/monitors/:id` | Modifier la configuration | ✅ |
| DELETE | `/monitors/:id` | Supprimer | ✅ |
| POST | `/monitors/:id/pause` | Mettre en pause | ✅ |
| POST | `/monitors/:id/resume` | Reprendre | ✅ |
| GET | `/monitors/:id/logs` | Historique des checks (paginated) | ✅ |
| GET | `/monitors/:id/uptime` | Taux d'uptime (30j/90j/custom) | ✅ |
| GET | `/monitors/:id/status-timeline` | Timeline uptime/downtime | ✅ |
| POST | `/monitors/bulk` | Création en masse | ✅ |

**Types de monitors supportés :** `api`, `website`, `tcp`, `heartbeat`
*(ping/ICMP simulé en PoC)*

### Groupes de monitors

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/monitor-groups` | Lister les groupes | ✅ |
| POST | `/monitor-groups` | Créer un groupe | ✅ |
| GET | `/monitor-groups/:id` | Détails | ✅ |
| PUT | `/monitor-groups/:id` | Modifier | ✅ |
| DELETE | `/monitor-groups/:id` | Supprimer | ✅ |

### Probes

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/probes` | Lister les probes actives | ✅ |
| GET | `/probes/:id/health` | Santé et latence d'une probe | ✅ |

---

## 5. Incidents (`/api/v1/`)

> Cycle de vie complet des incidents avec notes, timeline, postmortems.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/incidents` | Lister (filtres: state, severity, monitor, assignee) | ✅ |
| POST | `/incidents` | Créer manuellement | ✅ |
| GET | `/incidents/:id` | Détails + timeline complète | ✅ |
| PUT | `/incidents/:id` | Modifier (état, sévérité, titre) | ✅ |
| DELETE | `/incidents/:id` | Supprimer | ✅ |
| POST | `/incidents/:id/acknowledge` | Accuser réception | ✅ |
| POST | `/incidents/:id/resolve` | Résoudre | ✅ |
| POST | `/incidents/:id/assign` | Assigner à un utilisateur | ✅ |
| GET | `/incidents/:id/notes` | Lister les notes | ✅ |
| POST | `/incidents/:id/notes` | Ajouter une note (interne ou publique) | ✅ |
| GET | `/incidents/:id/timeline` | Timeline unifiée | ✅ |
| POST | `/incidents/:id/timeline` | Ajouter une entrée personnalisée | ✅ |
| GET | `/incidents/:id/postmortem` | Récupérer le postmortem | ✅ |
| POST | `/incidents/:id/postmortem` | Créer/mettre à jour le postmortem | ✅ |
| GET | `/incident-states` | Lister les états personnalisés | ✅ |
| POST | `/incident-states` | Créer un état | ✅ |
| PUT | `/incident-states/:id` | Modifier | ✅ |
| DELETE | `/incident-states/:id` | Supprimer (interdit pour états système) | ✅ |
| GET | `/incident-severities` | Lister les sévérités | ✅ |
| POST | `/incident-severities` | Créer une sévérité | ✅ |
| PUT | `/incident-severities/:id` | Modifier | ✅ |
| DELETE | `/incident-severities/:id` | Supprimer (interdit pour sévérités système) | ✅ |

**Sévérités système :** `critical`, `high`, `medium`, `low`
**États système :** `investigating`, `identified`, `monitoring`, `resolved`

---

## 6. Maintenance planifiée (`/api/v1/`)

> Fenêtres de maintenance pour suspendre les alertes pendant les interventions.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/scheduled-maintenance` | Lister les maintenances | ✅ |
| POST | `/scheduled-maintenance` | Créer une fenêtre de maintenance | ✅ |
| GET | `/scheduled-maintenance/:id` | Détails | ✅ |
| PUT | `/scheduled-maintenance/:id` | Modifier | ✅ |
| DELETE | `/scheduled-maintenance/:id` | Supprimer | ✅ |
| POST | `/scheduled-maintenance/:id/cancel` | Annuler | ✅ |

> Transitions automatiques `scheduled → in_progress → completed` assurées par le scheduler.

---

## 7. Status Pages (`/api/v1/`)

> Pages de statut publiques ou privées pour communiquer l'état des services.

### Gestion (authentifié)

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/status-pages` | Lister les pages du projet | ✅ |
| POST | `/status-pages` | Créer une page | ✅ |
| GET | `/status-pages/:id` | Détails + ressources | ✅ |
| PUT | `/status-pages/:id` | Modifier | ✅ |
| DELETE | `/status-pages/:id` | Supprimer | ✅ |
| GET | `/status-pages/:id/resources` | Lister les ressources affichées | ✅ |
| POST | `/status-pages/:id/resources` | Ajouter un monitor/groupe | ✅ |
| DELETE | `/status-pages/:id/resources/:rid` | Retirer une ressource | ✅ |
| GET | `/status-pages/:id/announcements` | Lister les annonces | ✅ |
| POST | `/status-pages/:id/announcements` | Créer une annonce | ✅ |
| GET | `/status-pages/:id/subscribers` | Lister les abonnés vérifiés | ✅ |
| DELETE | `/status-pages/:id/subscribers/:sid` | Supprimer un abonné | ✅ |
| PUT | `/status-pages/:id/branding` | Logo, couleur primaire, CSS | ✅ |
| PUT | `/status-pages/:id/domain` | Configurer le domaine personnalisé | ✅ |

### Endpoints publics (sans authentification)

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/status/:slug` | Page publique avec ressources + annonces actives | ✅ |
| POST | `/status/:slug/subscribe` | S'abonner aux notifications | ✅ |

---

## 8. Webhooks (`/api/v1/`)

> Notifications sortantes signées HMAC-SHA256 avec système de retry automatique.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/webhooks` | Lister les webhooks | ✅ |
| POST | `/webhooks` | Créer un webhook (secret auto-généré si non fourni) | ✅ |
| GET | `/webhooks/:id` | Détails | ✅ |
| PUT | `/webhooks/:id` | Modifier | ✅ |
| DELETE | `/webhooks/:id` | Supprimer | ✅ |
| GET | `/webhooks/:id/deliveries` | 100 derniers envois | ✅ |
| POST | `/webhooks/:id/deliveries/:did/retry` | Forcer le retry d'un envoi échoué | ✅ |

**Headers envoyés sur chaque webhook :**
```
X-OneUptime-Signature: sha256=<hmac>
X-OneUptime-Timestamp: <unix_ts>
X-OneUptime-Event: incident.created
X-OneUptime-Delivery: <uuid>
```

**Stratégie de retry :** immédiat → 30s → 5min → 30min → exhausted

**Événements émis automatiquement :**
- `incident.created`, `incident.acknowledged`, `incident.resolved`
- `incident.note_added`, `incident.postmortem_published`
- `scheduled_maintenance.created`, `.started`, `.ended`
- `monitor.status_changed`

---

## 9. Journal d'audit (`/api/v1/`)

> Log immuable en chaîne de hash SHA-256 pour conformité SOC2/HIPAA/GDPR.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/audit-log` | Lister les entrées (filtres: action, resource_type, actor_type, since, until) | ✅ |
| GET | `/audit-log/:id` | Détails d'une entrée | ✅ |
| GET | `/audit-log/verify` | Vérifier l'intégrité de la chaîne de hash | ✅ |
| GET | `/audit-log/export?format=csv` | Export CSV pour SIEM | ✅ |
| GET | `/audit-log/export?format=jsonl` | Export JSONL (NDJSON) pour SIEM | ✅ |

### Politiques de rétention

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/retention-policies` | Lister les politiques du projet | ✅ |
| POST | `/retention-policies` | Créer une politique | ✅ |
| PUT | `/retention-policies/:id` | Modifier | ✅ |
| DELETE | `/retention-policies/:id` | Supprimer | ✅ |

**Types de données gérés :** `monitor_checks`, `audit_logs`, `webhook_deliveries`, `incidents_resolved`

---

## 10. Admin API (`/api/v1/admin/`)

> Endpoints super-admin pour la gestion globale de la plateforme.

| Méthode | Endpoint | Description | Statut |
|---------|----------|-------------|--------|
| GET | `/admin/tenants` | Lister tous les tenants | ✅ |
| POST | `/admin/tenants` | Créer un tenant | ✅ |
| GET | `/admin/tenants/:id` | Détails + stats | ✅ |
| PUT | `/admin/tenants/:id` | Modifier plan/status/settings | ✅ |
| POST | `/admin/tenants/:id/suspend` | Suspendre | ✅ |
| POST | `/admin/tenants/:id/activate` | Réactiver | ✅ |
| DELETE | `/admin/tenants/:id` | Supprimer en cascade | ✅ |
| POST | `/admin/tenants/:id/impersonate` | JWT d'impersonation (support) | ✅ |
| GET | `/admin/tenants/:id/usage` | Métriques d'usage | ✅ |
| GET | `/admin/audit-log` | Journal d'audit global cross-tenant | ✅ |
| GET | `/admin/system/health` | Santé DB + queue webhooks | ✅ |
| GET | `/admin/system/metrics` | Statistiques globales | ✅ |

> Tous ces endpoints nécessitent `is_superuser=True`.

---

## 11. Scheduler — Automatisations

> Processus séparé qui exécute les jobs en arrière-plan.

| Job | Fréquence | Rôle | Statut |
|-----|-----------|------|--------|
| `run_checks` | Chaque minute | Exécuter les checks monitors, ouvrir/fermer les incidents | ✅ |
| `process_maintenance` | Chaque minute | Transitions scheduled→in_progress→completed | ✅ |
| `process_webhook_deliveries` | Chaque minute | Livrer les webhooks en attente avec retry | ✅ |
| `purge_expired` | 03:00 chaque jour | Supprimer les données dépassant les politiques de rétention | ✅ |

**Démarrage :** `python manage.py run_scheduler`

---

## 12. Sécurité transversale

| Fonctionnalité | Statut | Détail |
|----------------|--------|--------|
| JWT (access 15min + refresh 7j) | ✅ | SimpleJWT avec rotation et blacklist |
| API Keys hashées SHA-256 | ✅ | Format `ok_live_*`, révocables, avec expiry |
| MFA TOTP | ✅ | Compatible Google Authenticator, Authy |
| Row-Level Security PostgreSQL | ✅ | `CREATE POLICY tenant_isolation` sur 20 tables |
| Rate Limiting | ✅ | Headers X-RateLimit-*, tiers par plan, 429 RFC 7807 |
| CORS | ✅ | Configurable via `CORS_ALLOWED_ORIGINS` |
| RFC 7807 Problem Details | ✅ | Format uniforme pour toutes les erreurs |
| OpenAPI 3.1 auto-générée | ✅ | Via drf-spectacular |

**Limites par plan :**

| Plan | Requêtes/minute |
|------|----------------|
| free | 100 |
| growth | 500 |
| scale | 1 000 |
| enterprise | 5 000 |
| anonymous | 60 |

---

---

# MODULES NON IMPLÉMENTÉS

---

## ❌ §16 — On-Call & Alertes

> Plannings de garde, politiques d'escalade, gestion des alertes.

**Aucune trace dans le code.** Modules entiers à créer :

| Endpoint CDC | Description |
|-------------|-------------|
| `GET/POST /on-call-schedules` | Plannings de rotation |
| `GET /on-call-schedules/:id/timeline` | Qui est de garde sur une période |
| `POST /on-call-schedules/:id/overrides` | Remplacements (congés) |
| `GET/POST /escalation-policies` | Politiques d'escalade (N minutes sans ACK → escalader) |
| `GET /alerts` | Liste des alertes actives |
| `POST /alerts/:id/acknowledge` | Accuser réception d'une alerte |
| `POST /alerts/:id/resolve` | Résoudre |
| `POST /alerts/:id/snooze` | Mettre en snooze N minutes |
| `POST /alerts/:id/escalate` | Escalade manuelle |

**Modèles à créer :** `OnCallSchedule`, `OnCallRotation`, `EscalationPolicy`, `EscalationStep`, `Alert`

**Effort estimé :** 3–4 semaines

---

## ❌ §17 — Télémétrie (Logs, Métriques, Traces)

> Ingestion et requêtage de logs/métriques/traces via OTLP.

**Aucune trace dans le code.** Modules entiers à créer :

| Endpoint CDC | Description |
|-------------|-------------|
| `GET /logs` | Requêter les logs |
| `POST /logs/ingest` | Ingestion REST |
| `GET /metrics` | Requêter les métriques |
| `POST /metrics/ingest` | Ingestion REST |
| `GET /traces` | Requêter les traces |
| `GET /traces/:traceId` | Trace complète avec spans |
| `GET /traces/service-map` | Carte des dépendances services |
| `GET /exceptions` | Exceptions groupées |

> ⚠️ Le CDC préconise ClickHouse pour la télémétrie. Le projet utilise PostgreSQL uniquement. Un choix architectural doit être fait avant d'implémenter ce module.

**Effort estimé :** 4–6 semaines

---

## ❌ §18 — Moteur de Workflows

> Automatisations déclenchées par des événements (incident créé → envoyer Slack, etc.)

**Partiellement dans le code :** les fenêtres de maintenance (`scheduled-maintenance`) sont déjà dans ce §. Le moteur de workflows lui-même est absent.

| Endpoint CDC | Description |
|-------------|-------------|
| `GET/POST /workflows` | Définitions de workflows |
| `POST /workflows/:id/execute` | Déclenchement manuel |
| `GET /workflows/:id/runs` | Historique d'exécution |
| `POST /workflows/:id/enable` | Activer |
| `POST /workflows/:id/disable` | Désactiver |

**Modèles à créer :** `Workflow`, `WorkflowTrigger`, `WorkflowStep`, `WorkflowRun`

**Effort estimé :** 3–4 semaines

---

## ❌ §3 — SSO / SAML 2.0

> Authentification fédérée (Okta, Azure AD, Google Workspace) avec provisionnement SCIM.

| Endpoint CDC | Description |
|-------------|-------------|
| `GET /sso/metadata/:projectId` | Métadonnées SP (Service Provider) |
| `POST /sso/acs/:projectId` | Assertion Consumer Service |
| `POST /scim/v2/Users` | Provisionnement utilisateurs (Okta/Azure) |
| `POST /scim/v2/Groups` | Provisionnement groupes |
| Config IdP (entity_id, cert, JIT, enforce_sso) | Table `sso_config` |

**Effort estimé :** 4–6 semaines

---

## 🟡 Fonctionnalités partielles dans modules existants

| Fonctionnalité | Module | Statut | Ce qui manque |
|----------------|--------|--------|---------------|
| Tests unitaires | Tous | 🟡 | Seul `accounts/tests/test_auth.py` existe. Aucune couverture sur monitoring, incidents, webhooks, audit |
| Notifications email/SMS d'alertes | Monitoring | 🟡 | Pas de `NotificationRule` ni de `NotificationChannel`. Les webhooks couvrent partiellement |
| Export SIEM multi-format | Audit | 🟡 | CSV et JSONL OK. Pas de push vers Splunk/Elasticsearch |
| Pagination cursor-based | Tous | 🟡 | DRF CursorPagination configurée. Pas encore partout |
| `POST /webhooks/:id/test` | Webhooks | ❌ | Envoi d'un événement test manuel |
| `DELETE /on-call-schedules/:id` | On-Call | ❌ | Module inexistant |
| Terraform Provider | Infrastructure | ❌ | Hors scope backend Python |
| Hardened Docker images | DevOps | ❌ | Distroless, Trivy, cosign, SBOM |
| Data Residency / CMK | Infrastructure | ❌ | Routing région, chiffrement client-managed keys |

---

---

# RÉCAPITULATIF GÉNÉRAL

## Ce qui est prêt (production-ready)

```
✅ Authentification complète (JWT, API Keys, MFA, invitations, GDPR)
✅ Multi-tenancy avec isolation RLS PostgreSQL
✅ RBAC avancé (rôles custom, teams, resource_policy)
✅ Monitoring (HTTP, TCP, heartbeat) + automatisation checks
✅ Gestion d'incidents (cycle complet, postmortems, timeline)
✅ Maintenance planifiée (transitions automatiques)
✅ Status Pages (publiques + privées)
✅ Webhooks (HMAC, retry, historique)
✅ Journal d'audit immuable (hash chain, export SIEM)
✅ Admin API (impersonation, métriques, santé système)
✅ Rate Limiting (headers X-RateLimit-*, tiers par plan)
✅ OpenAPI 3.1 auto-générée
```

## Ce qui reste à faire (par priorité)

```
Priorité 1 — Fonctionnalités core manquantes
├── §16 On-Call & Alertes     (0% — 3-4 semaines)
└── §18 Workflows engine      (10% — 3-4 semaines)

Priorité 2 — Observabilité
└── §17 Télémétrie            (0% — 4-6 semaines + décision ClickHouse vs Postgres)

Priorité 3 — Entreprise
├── §3  SSO / SAML 2.0        (0% — 4-6 semaines)
└── Tests de couverture       (< 5% — 1-2 semaines)

Priorité 4 — Nice to have
├── Notifications email/SMS alertes (hors webhooks)
├── POST /webhooks/:id/test
└── Pagination cursor-based uniformisée
```

---

## Démarrage rapide

```bash
# 1. Configurer l'environnement
cp .env.exemple .env
# Éditer .env : DJANGO_SECRET_KEY, POSTGRES_PASSWORD, DATABASE_URL

# 2. Démarrer la base de données
docker compose --env-file .env -f docker/docker-compose-dev.yml up -d db

# 3. Installer les dépendances et migrer
pip install -r requirements.txt
python manage.py migrate

# 4. Créer le super-admin
python manage.py createsuperuser

# 5. (Optionnel) Données de démo
python manage.py seed_demo

# 6. Lancer le serveur
python manage.py runserver        # API sur http://localhost:8000

# 7. Lancer le scheduler (dans un autre terminal)
python manage.py run_scheduler    # Automatisations toutes les minutes
```

---

*Document généré le 29 Mai 2026 — OneUptime Backend v1.0*
