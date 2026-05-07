# Cahier des charges — Observabilité Skills Claude Code (MVP)

## Objectif

Outil standalone d'observabilité pour les Skills Claude Code en entreprise. Le MVP couvre deux features : **usage réel** des skills et **détection des shadow skills**. Déploiement self-hosted en environnement airgap.

## Périmètre fonctionnel

### Inclus dans le MVP
- Ingestion OTLP HTTP/JSON des events Claude Code
- Authentification admin (login email + password)
- Génération, listing et révocation de tokens d'ingestion (JWT)
- Dashboard d'usage des skills (top skills, par user, par jour, par trigger source)
- Détection de shadow skills par comparaison à une allowlist éditable
- Audit log des actions sensibles
- Alertes d'expiration de tokens (UI + email si SMTP configuré)

### Hors périmètre MVP
- Multi-organisation (mono-tenant pour la V1)
- Distribution de skills (Packmind ou autre marketplace assure ce rôle)
- Gouvernance et workflow d'approbation
- ROI / efficacité avancée (acceptance rate, rework rate) — V2
- SSO / OIDC — V1.5
- Métriques OTLP (logs uniquement) — V2

## Architecture

```
Claude Code (postes dev) 
  → OTLP HTTP/JSON + JWT Bearer 
  → Backend Hono (Node runtime) 
  → PostgreSQL 
  → Frontend React
```

**Pas de collector intermédiaire.** Claude Code envoie directement au backend via les variables d'env standard OTel.

## Stack technique

| Couche | Choix |
|---|---|
| Dev runtime | Bun |
| Production runtime | Node 22 LTS |
| Framework backend | Hono (runtime-agnostic) |
| ORM | Drizzle ou Kysely |
| Base de données | PostgreSQL 15+ |
| Frontend | React + Vite + Tailwind + shadcn/ui |
| JWT | `jose` |
| Password hashing | `argon2` |
| Email | `nodemailer` (SMTP fourni par le client) |
| Distribution | Image Docker multi-stage (Bun build → Node runtime) |

## Configuration côté Claude Code

L'admin colle ce bloc dans `settings.json` après onboarding :

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "https://<base-url>/api/v0/telemetry/v1/logs",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <jwt>",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORT_INTERVAL": "5000",
    "OTEL_LOG_TOOL_DETAILS": "1",
    "OTEL_METRICS_EXPORTER": "none"
  }
}
```

`OTEL_LOG_TOOL_DETAILS=1` est obligatoire pour récupérer les noms de skills custom (sinon redactés en `custom_skill`).

## Modèle de données

### Tables principales

- **`users`** — admins du produit (id, email, password_hash, role, created_at)
- **`tokens`** — tokens d'ingestion JWT (id, jti, name, user_label, created_at, expires_at, revoked_at)
- **`events`** — events OTLP ingérés (id, user_email, session_id, event_name, timestamp, attributes JSONB)
- **`allowed_skills`** — allowlist pour shadow detection (skill_name, source, added_at, added_by)
- **`audit_events`** — log d'actions sensibles (id, actor_email, action, target, timestamp, metadata)
- **`revoked_tokens`** — index des `jti` révoqués (jti, revoked_at)

### Indexes critiques

- `events (event_name, timestamp DESC)`
- Index partiel `events ((attributes->>'skill.name'), timestamp) WHERE event_name = 'claude_code.skill_activated'`
- `events (session_id)`
- `events (user_email, timestamp DESC)`

## Endpoints backend

### Ingestion (publique, JWT requis)
- `POST /api/v0/telemetry/v1/logs` — receveur OTLP HTTP/JSON

### Auth
- `POST /api/auth/login` — email + password → cookie session
- `POST /api/auth/logout`

### Tokens
- `GET /api/tokens` — liste
- `POST /api/tokens` — création (renvoie le JWT une seule fois)
- `DELETE /api/tokens/:id` — révocation

### Dashboards
- `GET /api/skills/usage` — agrégations par skill, période, user
- `GET /api/skills/shadow` — skills activées hors allowlist
- `GET /api/skills/allowed` — gestion de l'allowlist
- `POST /api/skills/allowed`, `DELETE /api/skills/allowed/:name`

### Système
- `GET /health` — liveness + DB check + version

## Pages frontend

1. **Login** — auth admin
2. **Dashboard** — vue d'ensemble usage : top 10 skills, courbe d'activations 30j, top users, répartition par trigger source
3. **Shadow Detection** — table des skills activées hors allowlist avec count, first seen, last seen, users impactés
4. **Allowlist** — édition de la liste des skills autorisées
5. **Tokens** — création, listing, révocation, alertes d'expiration
6. **Audit Log** — historique des actions sensibles
7. **Onboarding** — affiché au premier login : génère le premier token et affiche le bloc env complet à copier

## Sécurité

- Password admin hashé en argon2id
- JWT signés HS256 avec secret serveur ; rotation à deux secrets prévue dès la V1 (`current` + `previous`)
- Vérification systématique `jti` non révoqué à l'ingestion
- TLS terminé par reverse proxy externe (nginx, Traefik, LB corporate) — backend en HTTP plain interne
- Aucune sortie réseau hors SMTP du client
- Pas de telemetry produit phone-home

## Contraintes airgap

- Image Docker auto-suffisante, livrée en tarball signé et checksumé
- Aucune dépendance runtime à des registres externes (Docker Hub, npm, CDN)
- Image base Node depuis registry public mirrorable (`node:22-alpine`)
- Configuration intégralement par variables d'env
- SMTP fourni par le client ; dégradation propre en bandeau UI si absent
- Postgres fourni par le client (ou image Postgres officielle livrée à côté)
- Pas d'auto-update, pas de check de version distant

## Configuration runtime (variables d'env)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string Postgres |
| `JWT_SECRET` | Secret HS256 courant |
| `JWT_SECRET_PREVIOUS` | Secret précédent (rotation) |
| `PUBLIC_BASE_URL` | URL publique du produit (pour génération du bloc env) |
| `ADMIN_EMAIL` | Compte admin créé au boot si DB vide |
| `ADMIN_PASSWORD_INITIAL` | Password initial (à changer à la première connexion) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Config SMTP optionnelle |
| `PORT` | Port d'écoute (défaut 4200) |

## Déploiement et stack de dev locale

### `docker-compose.yml` de dev

Trois services : `postgres`, `app` (build local), et optionnellement `mailhog` pour tester les emails sans SMTP réel. Volume Postgres persistant pour ne pas perdre la donnée entre redémarrages.

### `docker-compose.yml` de production (livré au client)

Deux services : `postgres` et `app`. Réseau interne uniquement, le client met son reverse proxy TLS devant.

### Healthcheck Docker
Endpoint `/health` interrogé toutes les 30s, échec après 3 essais.

## Critères d'acceptation MVP

- [ ] Un admin peut s'authentifier et générer un token JWT en moins de 2 minutes après le premier boot
- [ ] Le bloc env Claude Code est affiché tel quel à copier
- [ ] Les events `claude_code.skill_activated` sont ingérés et persistés
- [ ] Le dashboard affiche le top skills sur 30 jours avec drill-down par user
- [ ] La page Shadow Detection liste correctement les skills activées hors allowlist
- [ ] La révocation d'un token bloque l'ingestion en moins de 5 secondes
- [ ] Une alerte UI s'affiche pour les tokens expirant dans <7 jours
- [ ] L'image Docker se charge et démarre en environnement airgap sans aucun appel réseau sortant
- [ ] Les opérations sensibles (login, token created, token revoked, allowlist modifiée) apparaissent dans l'audit log

## Livrables

1. Image Docker tarballée + checksum SHA256 + signature GPG
2. `docker-compose.yml` de production avec Postgres
3. README d'installation airgap (load, config, démarrage, backup, upgrade)
4. Bill of materials des dépendances tierces avec licences
5. Schéma réseau (ports, flux internes)
6. Procédure de backup/restore Postgres
