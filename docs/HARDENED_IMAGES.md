# Images conteneurs renforcées — OneUptime

Implémentation du document Enterprise §5 (Hardened Container Images), adaptée au backend **Python/Django**.

> Le document de référence cite `gcr.io/distroless/nodejs20-debian12` (stack Node.js).
> Pour Django, l'équivalent est un **build multi-stage slim** : pas de compilateur en runtime,
> utilisateur non-root, surface d'attaque minimale. Le distroless Python pur n'est pas utilisé
> car `python3-saml` requiert `libxmlsec1` en runtime.

---

## 1. Checklist Enterprise

| Exigence | Implémentation | Fichier |
|----------|----------------|---------|
| Build multi-stage (pas de gcc en prod) | ✅ Builder + runtime séparés | `Dockerfile.hardened` |
| Exécution non-root `USER 1000` | ✅ | `Dockerfile.hardened` |
| Système de fichiers lecture seule | ✅ `read_only: true` + volumes | `docker-compose.hardened.yml` |
| Pas de capabilities Linux | ✅ `cap_drop: ALL` (+ `NET_BIND_SERVICE`) | compose + K8s |
| Scan CVE Trivy (bloquer CRITICAL/HIGH) | ✅ CI | `.github/workflows/hardened-build.yml` |
| Signature cosign (Sigstore keyless) | ✅ CI (push main) | idem |
| SBOM CycloneDX (Syft) | ✅ Artefact CI 90 jours | idem |
| Manifests K8s `securityContext` | ✅ | `deploy/kubernetes/oneuptime-web.yaml` |
| Politique admission Kyverno | ✅ (audit) | `deploy/kubernetes/kyverno-verify-images.yaml` |

---

## 2. Fichiers — ce qui change (et ce qui ne change pas)

| Fichier | Rôle |
|---------|------|
| `Dockerfile` | **Inchangé** — dev + prod standard (`docker-compose-dev.yml`, `docker-compose.prod.yml`) |
| `Dockerfile.hardened` | **Nouveau** — image Enterprise durcie |
| `docker-compose.hardened.yml` | **Nouveau** — stack prod avec sécurité renforcée |

Le flux de développement local (`make db-up`, `docker-compose-dev.yml`) **n'est pas impacté**.

---

## 3. Build et déploiement local

### Build manuel

```bash
docker build -f Dockerfile.hardened -t oneuptime-api:hardened .
```

### Stack complète durcie

```bash
# Depuis la racine du backend
make docker-build-hardened
make docker-up-hardened

# Ou directement
docker compose --env-file .env -f docker/docker-compose.hardened.yml up -d --build
```

### Vérifier l'utilisateur non-root

```bash
docker compose -f docker/docker-compose.hardened.yml exec web id
# → uid=1000(oneuptime) gid=1000(oneuptime)
```

### Scan Trivy local

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --severity CRITICAL,HIGH oneuptime-api:hardened
```

### SBOM local (Syft)

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  anchore/syft:latest docker:oneuptime-api:hardened -o cyclonedx-json > sbom.json
```

---

## 4. Pipeline CI (`hardened-build.yml`)

Déclenché sur push/PR modifiant le code applicatif ou `Dockerfile.hardened`.

```
checkout → build Dockerfile.hardened
         → Trivy (CRITICAL/HIGH → échec CI)
         → Syft SBOM → artefact GitHub
         → cosign sign (keyless, push main)
         → push GHCR (push main uniquement)
```

**Sur une PR :** build + Trivy + SBOM (pas de push registry).

**Sur main :** en plus, push `ghcr.io/<org>/oneuptime-api:hardened` + signature cosign.

---

## 5. Kubernetes

```bash
# Créer le secret d'environnement (adapter les valeurs)
kubectl create namespace oneuptime
kubectl create secret generic oneuptime-env \
  --from-env-file=.env \
  -n oneuptime

kubectl apply -f deploy/kubernetes/oneuptime-web.yaml
```

Points clés du manifest :
- `runAsUser: 1000`, `readOnlyRootFilesystem: true`
- `capabilities.drop: [ALL]`, `allowPrivilegeEscalation: false`
- `seccompProfile: RuntimeDefault`
- Volumes `emptyDir` pour `/tmp` et `staticfiles`

### Kyverno (optionnel)

```bash
kubectl apply -f deploy/kubernetes/kyverno-verify-images.yaml
```

Mode `Audit` par défaut — passer en `Enforce` une fois les images signées en production.

---

## 6. Secrets et configuration

- **Aucun secret dans l'image** — variables via `.env`, secrets K8s ou Vault CSI
- Ne jamais `COPY .env` dans le Dockerfile (exclu par `.dockerignore`)
- Utiliser `env_file` / `secretRef` au runtime

---

## 7. Dépannage

| Problème | Solution |
|----------|----------|
| `Permission denied` sur staticfiles | Vérifier le volume `static_hardened` monté sur `/app/staticfiles` |
| `read-only file system` au démarrage | `PYTHONDONTWRITEBYTECODE=1` est défini ; vérifier tmpfs `/tmp` |
| Trivy CI échoue | Corriger CVE CRITICAL/HIGH (`pip install --upgrade <pkg>`) |
| cosign sign échoue en fork | Normal — signing uniquement sur push vers main du repo principal |
| Healthcheck échoue | Attendre les migrations (start-period 40s) |

---

## 8. Références

- Document Enterprise §5 — Hardened Container Images
- `docs/API_REFERENCE.md` — statut DevOps
- [Trivy](https://aquasecurity.github.io/trivy/) · [Syft](https://github.com/anchore/syft) · [cosign](https://docs.sigstore.dev/cosign/overview/)
