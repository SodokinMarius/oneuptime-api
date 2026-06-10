# Guide SSO / SAML 2.0 + SCIM — OneUptime

Ce guide couvre la configuration et l'utilisation du module Enterprise SSO pour un déploiement auto-hébergé.

**Prérequis :** backend Django avec `apps.sso` migré, frontend React sur le port 3000.

---

## 1. Architecture

```
Utilisateur                    IdP (Okta/Azure/Google)              OneUptime
    │                                │                                  │
    │── Login SSO (frontend) ────────│                                  │
    │── GET /sso/login/:projectId/ ──────────────────────────────────►│
    │◄── Redirect SAML AuthnRequest ─│                                  │
    │── Authentification IdP ───────►│                                  │
    │◄── POST SAMLResponse ──────────│                                  │
    │                                  │── ACS /sso/acs/:projectId/ ───►│
    │◄── Redirect /sso/callback ───────────────────────────────────────│
    │── JWT stocké → Dashboard       │                                  │
```

**SCIM** (provisioning machine-to-machine, sans UI) :

```
IdP (Okta/Azure) ── Bearer scim_token ──► POST /scim/v2/Users
                                         POST /scim/v2/Groups
```

---

## 2. Configuration serveur

### 2.1 Variables d'environnement (`.env`)

```bash
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000

# Certificat SP (obligatoire pour la signature SAML en production)
openssl req -x509 -newkey rsa:2048 -keyout sp.key -out sp.crt -days 3650 -nodes -subj "/CN=oneuptime-sp"
```

Coller le contenu PEM dans `.env` (échapper les retours à la ligne ou utiliser un fichier monté) :

```bash
SSO_SP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

SSO_SP_CERT="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
```

### 2.2 Dépendances système

```bash
# Debian/Ubuntu (Dockerfile déjà configuré)
apt-get install libxmlsec1-dev libxmlsec1-openssl pkg-config
pip install python3-saml
python manage.py migrate sso
```

### 2.3 CORS

Vérifier que `CORS_ALLOWED_ORIGINS` inclut l'URL du frontend :

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

---

## 3. Configuration SSO via l'interface (Settings → SSO)

1. Se connecter en tant qu'**admin** du projet
2. Aller dans **Paramètres → SSO**
3. Cliquer **+ Ajouter une configuration**
4. Renseigner :
   - **Provider** : Okta, Azure AD, Google ou Custom
   - **Nom** : ex. « Okta Production »
   - **Entity ID IdP** : issuer SAML de l'IdP
   - **SSO URL** : URL de connexion SAML de l'IdP
   - **Certificat X.509 IdP** : certificat public (corps PEM)
   - **Équipes par défaut** + **Rôle par défaut** : pour le JIT provisioning
   - **Activer** (`is_enabled`) une fois testé
5. Copier les **métadonnées SP** affichées :
   - **Entity ID SP** : `http://localhost:8000/api/v1/sso/metadata/<project_id>/`
   - **ACS URL** : `http://localhost:8000/api/v1/sso/acs/<project_id>/`

### Presets d'attributs IdP

| Provider | Endpoint presets |
|----------|------------------|
| Okta | `GET /api/v1/sso/config/provider-presets/` |
| Azure AD | Attributs Microsoft URIs pré-remplis |
| Google | email, first_name, last_name |

---

## 4. Configuration côté IdP

### Okta

1. Applications → Create App → SAML 2.0
2. **Single sign-on URL** : ACS URL ci-dessus
3. **Audience URI (SP Entity ID)** : Entity ID SP
4. **Name ID format** : EmailAddress
5. Attribute Statements : `email`, `firstName`, `lastName`
6. Assign users/groups

### Azure AD (Entra ID)

1. Enterprise Applications → New → Non-gallery
2. Single sign-on → SAML
3. **Identifier (Entity ID)** : Entity ID SP
4. **Reply URL** : ACS URL
5. **Name ID** : user.mail
6. Claims : givenname, surname, displayname

### Test local avec Keycloak (gratuit)

```bash
docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak start-dev
```

Créer un realm, un client SAML avec ACS URL et Entity ID SP.

---

## 5. Flux utilisateur (frontend)

Le frontend React (`Frontend/`) expose trois écrans SSO intégrés aux flux existants :

| Écran | Route | Fichier |
|-------|-------|---------|
| Login + bouton SSO | `/login` | `src/pages/auth/LoginPage.tsx` |
| Callback post-SAML | `/sso/callback` | `src/pages/auth/SSOCallbackPage.tsx` |
| Configuration IdP | `/settings` → onglet **SSO** | `src/pages/settings/SSOTab.tsx` |

### Login password + SSO

1. Page `/login` — saisir l'email
2. Si SSO configuré : bouton **« Continuer avec SSO »**
3. Redirect IdP → authentification → retour `/sso/callback` avec JWT
4. Redirection automatique vers `/dashboard`

### Démarrer le frontend

```bash
cd Frontend
npm run dev   # http://localhost:3000 — proxy /api et /scim vers :8000
```

### enforce_sso

Quand activé sur une config SSO :

- **Login password** refusé (`403`, `sso_required: true`)
- **API** sans token SSO pour ce projet → `406 sso_required`
- **Login SAML** émet un JWT avec claim `sso_projects: [<project_id>]`

---

## 6. Configuration SCIM

### Informations à fournir à l'admin IdP

| Paramètre | Valeur |
|-----------|--------|
| SCIM Base URL | `http://<host>/scim/v2/` |
| Auth | Bearer Token |
| Token | `scim_token` de la config SSO (visible à la création ou via **Régénérer**) |

> Note : le token SCIM est lié à la config SSO du projet. Une seule config active par projet est recommandée.

### Endpoints SCIM

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/scim/v2/ServiceProviderConfig` | Capacités |
| GET/POST | `/scim/v2/Users` | Lister / créer utilisateurs |
| GET/PUT/PATCH/DELETE | `/scim/v2/Users/:id` | Gérer un utilisateur |
| GET/POST | `/scim/v2/Groups` | Lister / créer groupes (= Teams) |
| GET/PUT/PATCH/DELETE | `/scim/v2/Groups/:id` | Gérer un groupe |

### Modes SCIM

| Option | Comportement |
|--------|--------------|
| `scim_auto_provision` | Crée les utilisateurs à la réception SCIM |
| `scim_auto_deprovision` | Retire des équipes (ne supprime pas le User) |
| `scim_enable_push_groups` | Groupes IdP → Teams ; utilisateurs sans groupe → équipe « Unassigned » |

### Logs SCIM

`GET /api/v1/sso/config/:id/scim-logs/` — historique des opérations (`scim_sync_log`).

---

## 7. API de gestion (admin)

Authentification JWT + headers `X-Tenant-Id`, `X-Project-Id`. Permission : `project:manage_sso`.

```bash
# Lister les configs
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-Id: $TENANT" \
     -H "X-Project-Id: $PROJECT" \
     http://localhost:8000/api/v1/sso/config/

# Créer une config
curl -X POST .../api/v1/sso/config/ \
  -d '{"name":"Okta","provider":"okta","entity_id":"...","sso_url":"...","x509_cert":"...","default_role_id":"...","default_team_ids":["..."],"is_enabled":true}'

# Découverte SSO (public)
curl "http://localhost:8000/api/v1/sso/discover/?email=user@example.com"
```

---

## 8. Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `python3-saml is not installed` | Dépendance manquante | `pip install python3-saml` + libxmlsec1 |
| `SAML validation failed` | Cert IdP incorrect ou issuer mismatch | Vérifier `entity_id` et `x509_cert` |
| `No project access for user` | Pas d'équipe/rôle par défaut | Configurer `default_teams` + `default_role` |
| Redirect callback sans tokens | ACS non atteint | Vérifier ACS URL dans l'IdP |
| `406 SSO Required` | enforce_sso sans login SAML | Se reconnecter via SSO |
| SCIM 401 | Token invalide | Régénérer `scim_token`, mettre à jour l'IdP |

---

## 9. Sécurité

- Ne jamais committer `SSO_SP_PRIVATE_KEY` ni `scim_token` dans git
- Régénérer le token SCIM en cas de fuite
- Activer `enforce_sso` uniquement après validation du flux SAML
- En production : HTTPS obligatoire pour `API_BASE_URL` et `FRONTEND_URL`

---

## 10. Références

- Spécification API : `docs/API_REFERENCE.md` §3
- OpenAPI interactive : `http://localhost:8000/api/v1/docs` (tag SSO)
- Code backend : `apps/sso/`
- Code frontend : `Frontend/src/pages/settings/SSOTab.tsx`, `Frontend/src/pages/auth/`
