# Cartulaire

> Serveur d'identité open source, **OAuth 2.1 / OpenID Connect first**, sans base de
> données imposée, orchestrant des microservices sécurisés pour toute opération métier.

Le cœur (`apps/api` + `packages/*`) ne lit ni n'écrit **jamais** dans une base de
données : il délègue chaque opération sensible (résolution d'identité, vérification de
mot de passe, consentement…) à des connecteurs, via un contrat de commande signé,
horodaté et auditable. Voir la spécification complète dans [`SPEC.md`](./SPEC.md).

## Structure du monorepo

Outillage : **yarn workspaces + Turborepo** (aligné sur les autres projets `@tacxou`).

```txt
apps/
  api/                  API NestJS (HTTP public, OAuth/OIDC, rendu Nunjucks) — ne touche aucune BDD
  daemon/               pont sécurisé : reçoit les commandes signées, route vers le bon connecteur
  web/                  (à venir) vues Nunjucks + assets statiques

packages/
  connector-contracts/  contrat de commande (schémas Zod §13) + catalogue de commandes (§14)
  crypto/               signature/vérification HMAC des commandes (§26.2)
  core/                 CommandClient signé (cœur → daemon → connecteur)
  connector-sdk/        SDK Node pour écrire un connecteur (dispatch, signature, réponses)
  config/               chargement + validation Zod de la config YAML/env (§32)
  logger/               logs structurés Pino avec redaction des secrets (§34.1)

connectors/
  mock/                 connecteur factice (utilisateurs en mémoire) pour la démo V0
```

### Le contrat de commande

Chaque appel du cœur vers une source de données passe par une **commande signée** :

```txt
apps/api ──(HMAC signé, expirable)──▶ apps/daemon ──(HMAC signé)──▶ connectors/*
                                          │
                                 vérifie signature + audience
                                 applique la liste blanche de permissions (§26.4)
                                 isole les erreurs, normalise la réponse
```

Deux liens de confiance indépendants, chacun avec son propre secret (§26.1) :
API ↔ daemon, puis daemon ↔ connecteur.

## Démarrer (slice V0)

```bash
cp .env.example .env      # puis renseigner les secrets (>= 16 caractères)
make install
make build

# 3 terminaux (ou `make dev` pour tout lancer via turbo) :
make dev-mock             # connecteur mock   → :8443
make dev-daemon           # daemon            → :8788
make dev-api              # API OIDC          → :9000
```

Découverte OIDC (issuer `http://localhost:9000/oidc`) :
`http://localhost:9000/oidc/.well-known/openid-configuration` — voir [`SPEC.md` §16.1](./SPEC.md).

Utilisateurs de démo (dans `connectors/mock`) : `clement` / `password123`,
`alice` / `hunter2`.

## Scripts

| Commande            | Effet                                        |
|---------------------|----------------------------------------------|
| `make build`        | build incrémental de tous les workspaces     |
| `make dev`          | tous les apps/connecteurs en watch (turbo)   |
| `make lint`         | lint de tous les workspaces                  |
| `make test`         | suites de tests de tous les workspaces       |

## Licence

AGPL-3.0-only.
