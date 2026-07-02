# Cartulaire — Spécification technique complète

> Serveur d'identité open source, *OAuth 2.1 / OpenID Connect first*, sans base de données imposée, orchestrant des microservices sécurisés pour toute opération métier.

**Statut :** Spécification de référence — v1.0
**Licence prévue :** à définir (recommandé : AGPLv3 ou MIT selon stratégie de diffusion)

---

## Sommaire

1. [Vision du projet](#1-vision-du-projet)
2. [Identité visuelle](#2-identité-visuelle)
3. [Nom du projet](#3-nom-du-projet)
4. [Objectifs](#4-objectifs)
5. [Non-objectifs](#5-non-objectifs)
6. [Principe fondamental](#6-principe-fondamental)
7. [Architecture générale](#7-architecture-générale)
8. [Organisation du monorepo](#8-organisation-du-monorepo)
9. [Stack technique](#9-stack-technique)
10. [Règle absolue sur les bases de données](#10-règle-absolue-sur-les-bases-de-données)
11. [Modèle d'exécution](#11-modèle-dexécution)
12. [Communication API ↔ daemon / microservices](#12-communication-api--daemon--microservices)
13. [Contrat de commande](#13-contrat-de-commande)
14. [Catalogue des commandes standard](#14-catalogue-des-commandes-standard)
15. [OAuth 2.1](#15-oauth-21)
16. [OpenID Connect](#16-openid-connect)
17. [CAS](#17-cas)
18. [SAML 2.0](#18-saml-20)
19. [Sessions](#19-sessions)
20. [Tokens](#20-tokens)
21. [Gestion des clients OAuth](#21-gestion-des-clients-oauth)
22. [Authentification utilisateur](#22-authentification-utilisateur)
23. [MFA](#23-mfa)
24. [UI / Frontend](#24-ui--frontend)
25. [Sécurité HTTP](#25-sécurité-http)
26. [Sécurité daemon / microservices](#26-sécurité-daemon--microservices)
27. [Connecteur LDAP](#27-connecteur-ldap)
28. [Connecteur MongoDB](#28-connecteur-mongodb)
29. [Connecteur SQL](#29-connecteur-sql)
30. [Connecteurs Python](#30-connecteurs-python)
31. [SDK connecteur](#31-sdk-connecteur)
32. [Configuration](#32-configuration)
33. [CLI](#33-cli)
34. [Observabilité](#34-observabilité)
35. [Audit](#35-audit)
36. [Politique d'erreurs](#36-politique-derreurs)
37. [Rate limiting](#37-rate-limiting)
38. [Reverse proxy](#38-reverse-proxy)
39. [Déploiement](#39-déploiement)
40. [Tests](#40-tests)
41. [Sécurité du code](#41-sécurité-du-code)
42. [Packages npm internes](#42-packages-npm-internes)
43. [Roadmap](#43-roadmap)
44. [Règles de base du projet](#44-règles-de-base-du-projet)
45. [Positionnement concurrentiel](#45-positionnement-concurrentiel)
46. [Glossaire](#46-glossaire)
47. [Résumé exécutif](#47-résumé-exécutif)

---

## 1. Vision du projet

**Cartulaire** est un serveur d'identité open source, orienté **OAuth 2.1 / OpenID Connect en priorité**, complété ensuite par **CAS** puis **SAML 2.0**. Il est pensé pour être léger, sécurisé, extensible, et administrable par des équipes d'infrastructure plutôt que par un département produit dédié à l'IAM.

Sa promesse centrale : fournir un serveur OIDC moderne **sans imposer de base de données, de modèle de stockage, ni de backend d'identité particulier**. Le cœur de Cartulaire ne lit ni n'écrit dans aucune base de données, qu'elle soit relationnelle, documentaire ou annuaire. Il délègue systématiquement toute opération sensible — résolution d'identité, vérification de mot de passe, lecture de groupes, écriture de consentement — à des **microservices sécurisés**, appelés par son API NestJS via un protocole strict, signé, horodaté et auditable.

L'administrateur système reste libre de choisir où vivent réellement les identités :

- LDAP / Active Directory
- base SQL (PostgreSQL, MySQL, MariaDB, SQLite)
- MongoDB
- API métier existante (HR, CRM, ERP interne)
- fichiers plats ou stockage interne
- script ou service maison dans n'importe quel langage

Cartulaire ne se substitue pas à ce système : il en devient la **passerelle de confiance**, le point unique qui transforme une source d'identité hétérogène en flux OAuth/OIDC/CAS/SAML standard.

---

## 2. Identité visuelle

### 2.1 Le sceau

Le logo retenu (`logo.png`) représente un **sceau de cire violet**, fondu et coulant, frappé en son centre d'une **empreinte digitale** stylisée. Le message est cohérent avec le nom et la fonction du projet : **identité, confiance, certification, preuve, sécurité, modernité**. Le sceau évoque directement la fonction du *cartulaire* historique — registre de chartes et de preuves authentifiées par cachet — transposée au numérique : Cartulaire scelle et authentifie, il ne stocke pas. L'empreinte digitale en son cœur ancre visuellement le concept d'identité personnelle vérifiée.

### 2.2 Palette de marque

Palette extraite directement du fichier fourni (`logo.png`), à figer dans `packages/ui` comme variables CSS / design tokens :

| Token | Hex | Usage |
|---|---|---|
| `--cartulaire-violet-100` | `#FCD8FC` | Reflets spéculaires, surbrillances sur le sceau |
| `--cartulaire-violet-400` | `#C048FC` | Violet clair, dégradé supérieur du sceau |
| `--cartulaire-violet-500` | `#A824FC` | **Violet de marque principal** — boutons primaires, liens, focus ring |
| `--cartulaire-violet-700` | `#7A0CE0` | Anneaux internes, bordures, hover des éléments primaires |
| `--cartulaire-violet-900` | `#4800B4` | Ombres profondes du sceau, texte sur fond clair, états actifs |

Le motif empreinte digitale est rendu en quasi-blanc translucide (`#FCD8FC` à opacité réduite) sur fond violet plein — ce contraste clair-sur-violet doit être repris pour tout pictogramme dérivé du sceau (favicon, badge MFA, icône de session).

### 2.3 Fond animé (`background.svg`)

Le second fichier fourni est un fond animé « grille réseau » sur base sombre (`#020617` → `#0F172A`), avec lignes et nœuds en camaïeu cyan/bleu ciel (`#38BDF8`, `#22D3EE`, `#67E8F9`), opacité faible (0.15) et particules de flux animées en SVG natif (`<animate>`).

Ce fond appartient à une famille de couleurs **froide** (cyan/ardoise) distincte de la famille **chaude/violette** du sceau. C'est un choix de contraste qui fonctionne bien tant que la hiérarchie reste claire : le sceau violet doit toujours rester l'élément le plus saturé et le plus net de l'écran, le fond réseau ne sert qu'à suggérer l'infrastructure/la connectivité en arrière-plan, jamais à rivaliser visuellement avec le sceau. Recommandations :

- conserver l'opacité basse (≤ 0.15-0.2) des lignes et nœuds cyan, ne jamais l'augmenter ;
- le sceau et le formulaire de login restent sur une carte glassmorphism semi-opaque posée par-dessus le fond, pas directement sur la grille ;
- si une cohérence chromatique plus stricte est souhaitée plus tard, les variantes `--cartulaire-accent-cyan-*` peuvent être teintées vers le violet (`#A824FC` à faible saturation) sans toucher à la structure du SVG — décision non bloquante, à trancher en phase UI.

### 2.4 Mise en œuvre technique

- `logo.png` → à vectoriser en SVG pour un rendu net à toute résolution (favicon, header, écran de login) ; conserver le PNG haute résolution comme source pour les exports (réseaux sociaux, README) ;
- `background.svg` → servi tel quel en fond de page `/login`, `/oauth/authorize`, `/cas/login`, derrière la carte de formulaire ;
- les deux fichiers sont servis statiquement par `apps/web` (`apps/web/public/assets/logo.svg`, `apps/web/public/assets/background.svg`), **jamais** chargés depuis un CDN externe — cohérent avec la CSP stricte ([§25](#25-sécurité-http)) ;
- favicon dérivé du sceau seul, sans empreinte trop fine (perd en lisibilité sous 32×32 px — prévoir une version simplifiée du motif pour ce format) ;
- le chemin du logo est exposé via `config.ui.logo` ([§32](#32-configuration)).

---

## 3. Nom du projet

### Cartulaire

Un *cartulaire* est, historiquement, un recueil d'actes, de chartes et de preuves juridiques conservé par une institution — abbaye, chapitre, seigneurie — pour faire foi des droits et engagements qu'il consigne.

Appliqué au projet, le nom porte plusieurs résonances :

- la **conservation logique** des identités, sans en être le propriétaire ;
- la **preuve d'authentification**, au sens juridique du terme ;
- les **droits d'accès** et leur traçabilité ;
- les **délégations** de confiance entre services ;
- les **chartes d'autorisation** (scopes, consentements, claims) ;
- la **confiance** comme matière première du projet plutôt que la donnée elle-même.

Cartulaire n'est donc pas un simple serveur de login : c'est le **garant des preuves d'identité et d'autorisation**, sans jamais devenir le dépositaire des identités elles-mêmes.

---

## 4. Objectifs

### 4.1 Objectifs fonctionnels

Cartulaire doit fournir, par ordre de priorité strict :

1. **OAuth 2.1**
2. **OpenID Connect**
3. **CAS**
4. **SAML 2.0**

```txt
OAuth 2.1 / OIDC  →  CAS  →  SAML 2.0
```

Chaque protocole legacy (CAS, SAML) doit être ajouté *après* la stabilisation du socle OAuth/OIDC, jamais en parallèle, pour éviter de fragiliser le cœur du projet.

### 4.2 Objectifs techniques

Cartulaire doit :

- être développé en **TypeScript strict** ;
- utiliser **NestJS** côté API ;
- exposer un front très léger : **Nunjucks** + **Tailwind CSS** + JavaScript minimal ;
- éviter toute SPA lourde sur les pages critiques d'authentification ;
- réduire la surface d'attaque au strict nécessaire ;
- être facilement auto-hébergeable, sans dépendance cloud obligatoire ;
- fonctionner en **monorepo** ;
- être extensible par microservices/connecteurs remplaçables ;
- fournir des connecteurs d'exemple en **Node.js et Python** ;
- ne **jamais** imposer de base de données au cœur du projet ;
- exposer une API interne stricte, signée, pour tout appel microservice ;
- permettre nativement l'intégration LDAP, SQL, MongoDB ou tout système tiers respectant le contrat de commande.

---

## 5. Non-objectifs

Cartulaire ne doit **pas** devenir :

- un Keycloak bis, ultra lourd et monolithique ;
- un annuaire LDAP ou une base utilisateur en soi ;
- un ORM centralisé ou un CMS d'identité ;
- un panneau d'administration tentaculaire ;
- une application full-JavaScript côté client ;
- une plateforme dépendante d'un unique mode de stockage.

Le cœur de Cartulaire ne doit **jamais** :

- lire directement dans PostgreSQL, MySQL, MongoDB, LDAP ou tout autre système ;
- écrire directement dans une base de données quelconque ;
- stocker durablement des utilisateurs dans son propre backend ;
- imposer Prisma, TypeORM, Mongoose ou Redis comme dépendance du cœur ;
- embarquer la logique métier d'identité dans le serveur principal.

---

## 6. Principe fondamental

### Cartulaire est stateless autant que possible

Le cœur du projet orchestre des flux d'authentification et d'autorisation **sans posséder directement les données métier**.

```txt
Navigateur
   ↓
Cartulaire Web / API NestJS
   ↓
Daemon / microservice sécurisé
   ↓
Script / backend choisi par l'administrateur
   ↓
LDAP / SQL / Mongo / API / autre
```

Cartulaire ne se demande jamais *« quelle base dois-je utiliser ? »*. Il se demande *« quel service sait répondre à cette opération ? »*. Cette inversion de responsabilité est la pierre angulaire de toute décision d'architecture future : si une fonctionnalité oblige le cœur à connaître un schéma de stockage, elle est mal placée et doit être déplacée vers un connecteur.

---

## 7. Architecture générale

```txt
apps/
  api/                 API NestJS principale (HTTP public, protocoles, rendu)
  daemon/              daemon d'exécution des scripts/connecteurs
  web/                 vues Nunjucks + Tailwind, assets statiques

packages/
  core/                logique commune, types partagés
  protocol-oauth/      OAuth 2.1
  protocol-oidc/       OpenID Connect
  protocol-cas/        CAS
  protocol-saml/       SAML 2.0
  connector-sdk/       SDK officiel pour écrire un connecteur
  connector-contracts/ types, schémas Zod, catalogue de commandes
  crypto/              signatures, JWE/JWS, helpers mTLS
  config/              chargement et validation de la configuration YAML/env
  logger/              logs structurés Pino
  audit/               émission des événements d'audit
  ui/                  composants Nunjucks/Tailwind réutilisables
  testing/             utilitaires de tests communs

connectors/
  ldap-node/
  ldap-python/
  sql-node/
  sql-python/
  mongo-node/
  mongo-python/
  mock/                connecteur factice pour développement/démo

examples/
  docker-compose/
  nginx/
  traefik/
  ldap/
  postgres/
  mysql/
  mongodb/
  production/
  development/

docs/
  architecture.md
  security.md
  oidc.md
  connector-protocol.md
  daemon.md
  deployment.md
  hardening.md
```

Trois couches, trois responsabilités strictement séparées :

| Couche | Rôle | Connaît le stockage ? |
|---|---|---|
| `apps/api` | Protocoles, HTTP, rendu, sessions | Non |
| `apps/daemon` | Pont sécurisé, exécution, isolation | Non (délègue au connecteur) |
| `connectors/*` | Lecture/écriture réelle | Oui — c'est son unique rôle |

---

## 8. Organisation du monorepo

### 8.1 Outillage recommandé

```txt
pnpm workspace
Turborepo
TypeScript project references
ESLint
Prettier
Vitest
Playwright
Docker Compose
```

`pnpm` pour la gestion d'espace de travail (cohérent avec les pratiques déjà en place sur les autres projets `@tacxou`), `Turborepo` pour l'orchestration de build/cache incrémental entre `apps/*`, `packages/*` et `connectors/*`.

### 8.2 Structure de dépôt

```txt
cartulaire/
  apps/
    api/
    daemon/
    web/
  packages/
    core/
    protocol-oauth/
    protocol-oidc/
    protocol-cas/
    protocol-saml/
    connector-sdk/
    connector-contracts/
    crypto/
    config/
    logger/
    audit/
    ui/
    testing/
  connectors/
    ldap-node/
    ldap-python/
    sql-node/
    sql-python/
    mongo-node/
    mongo-python/
    mock/
  examples/
  docs/
  scripts/
  docker/
  .github/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

### 8.3 Conventions

- fichiers en **kebab-case**, classes en **PascalCase**, variables/fonctions en **camelCase** (cohérent avec les conventions déjà en vigueur sur les autres projets) ;
- chaque package `packages/*` est publiable indépendamment sous le scope `@cartulaire/*` ([§42](#42-packages-npm-internes)) ;
- chaque connecteur `connectors/*` est un workspace autonome, avec son propre `package.json` (Node) ou `pyproject.toml` (Python), et peut être extrait du monorepo sans casser le cœur.

---

## 9. Stack technique

### 9.1 Backend principal

```txt
NestJS
Fastify adapter
TypeScript strict
Zod
jose
Nunjucks
Tailwind CSS
Pino
OpenTelemetry
```

NestJS avec l'adaptateur **Fastify** plutôt qu'Express, pour la performance, le typage plus strict des handlers, et une surface d'attaque réduite par rapport à Express.

### 9.2 Front

```txt
Nunjucks
Tailwind CSS
HTMX optionnel (désactivé par défaut)
JavaScript minimal
Content Security Policy stricte
```

Rendu majoritairement côté serveur. Pages typiques exposées par `apps/web` :

- login ;
- choix de méthode MFA ;
- consentement OAuth ;
- erreur ;
- logout ;
- device code ;
- changement de mot de passe (si activé) ;
- récupération de compte (si activée) ;
- écran d'administration léger (santé des connecteurs, configuration active).

### 9.3 Daemon et microservices

Le daemon Cartulaire (`apps/daemon`) est le pont entre l'API et les scripts/connecteurs. Il :

- écoute les commandes sécurisées émises par l'API ;
- valide les signatures et l'expiration des commandes ;
- charge sa configuration locale (connecteurs autorisés, permissions) ;
- exécute le script/connecteur adapté ;
- normalise la réponse (succès ou erreur) ;
- isole les erreurs d'un connecteur pour qu'elles ne remontent jamais brutes à l'API ;
- applique des timeouts stricts ;
- journalise chaque appel ;
- limite les permissions de chaque connecteur selon sa configuration.

Les scripts/connecteurs peuvent être écrits dans **n'importe quel langage**, à condition de respecter le contrat Cartulaire ([§13](#13-contrat-de-commande)). Le projet fournit officiellement :

```txt
Node.js
Python
```

avec des connecteurs d'exemple pour :

```txt
LDAP
SQL
MongoDB
Mock (développement / démo)
```

---

## 10. Règle absolue sur les bases de données

### 10.1 Interdiction stricte

Le cœur Cartulaire **ne doit jamais** exécuter ce type d'opération :

```ts
db.find(...)
db.insert(...)
db.update(...)
ldap.search(...)
mongoose.find(...)
sql.query(...)
```

Ces opérations sont **interdites** dans :

```txt
apps/api
apps/web
packages/core
packages/protocol-*
packages/ui
```

Cette interdiction doit être renforcée par l'outillage, pas seulement par convention : lint custom (ESLint rule interdisant l'import de drivers DB/LDAP dans ces dossiers) et revue de code obligatoire sur tout ajout de dépendance dans ces packages.

### 10.2 Seuls les connecteurs accèdent aux données

Les accès à une source de données réelle sont autorisés uniquement dans :

```txt
apps/daemon
connectors/*
examples/*
```

Exemples : `connectors/ldap-node`, `connectors/sql-node`, `connectors/mongo-node`, ou tout connecteur custom déployé par l'administrateur en dehors du monorepo officiel.

### 10.3 Conséquence opérationnelle

Cartulaire doit systématiquement appeler un microservice ou le daemon pour :

- vérifier un mot de passe ;
- lire un utilisateur, ses groupes, ses attributs ;
- sauvegarder ou révoquer un consentement ;
- invalider une session ;
- journaliser un événement d'audit externe ;
- changer un mot de passe ;
- récupérer la définition d'un client OAuth, si celui-ci n'est pas déclaré en configuration statique.

---

## 11. Modèle d'exécution

### 11.1 L'API principale

L'API principale (`apps/api`) gère :

- les routes HTTP publiques ;
- les flux OAuth/OIDC (et plus tard CAS/SAML) ;
- le rendu HTML via Nunjucks ;
- la sécurité HTTP (headers, CSP, cookies) ;
- les sessions navigateur ;
- la génération et la signature des tokens ;
- la vérification des clients OAuth ;
- la validation des réponses microservices reçues du daemon ;
- les logs applicatifs et l'audit ;
- la gestion centralisée des erreurs.

### 11.2 Le daemon

Le daemon (`apps/daemon`) gère :

- la réception des commandes émises par l'API ;
- l'exécution du script/connecteur ciblé ;
- l'orchestration des connecteurs LDAP / SQL / Mongo / API custom ;
- l'isolation des erreurs ;
- les timeouts ;
- la limitation des permissions par connecteur ;
- les logs techniques d'exécution ;
- le retour d'un résultat normalisé à l'API.

Le daemon peut être déployé :

- sur la même machine que l'API (mode simple) ;
- sur un réseau interne dédié ;
- dans un conteneur séparé ;
- au plus proche physiquement de la source de données ;
- dans un environnement strictement isolé (zone réseau restreinte, par exemple à proximité d'un Active Directory sensible).

### 11.3 Les scripts/connecteurs

Les connecteurs gèrent :

- la lecture utilisateur ;
- la vérification de credentials ;
- la lecture de groupes et de rôles ;
- la résolution de claims ;
- les politiques d'accès propres à la source ;
- la lecture/écriture métier déléguée ;
- la connexion technique (LDAP, SQL, MongoDB, API custom).

---

## 12. Communication API ↔ daemon / microservices

### 12.1 Deux modes supportés

#### Mode 1 — HTTP interne signé

Simple à déployer, recommandé pour démarrer.

```txt
POST /commands
Authorization: Bearer <service-token>
X-Cartulaire-Signature: ...
X-Cartulaire-Timestamp: ...
```

#### Mode 2 — gRPC avec mTLS

Recommandé pour la production avancée, à forte exigence de performance et de sécurité réseau.

```txt
Cartulaire API
   ↓ mTLS
Cartulaire daemon / connector gRPC
```

### 12.2 Recommandation par version

```txt
V1 : HTTP interne signé + mTLS optionnel
V2 : gRPC + mTLS
```

Cette progression permet de démarrer vite sans imposer dès la V0 une architecture trop lourde pour un déploiement mono-instance.

---

## 13. Contrat de commande

Chaque daemon ou microservice expose une entrée unique :

```txt
POST /commands
```

### 13.1 Requête

```json
{
  "id": "cmd_01H...",
  "type": "identity.resolve",
  "issuedAt": "2026-07-01T10:00:00.000Z",
  "expiresAt": "2026-07-01T10:00:05.000Z",
  "issuer": "cartulaire",
  "audience": "connector.ldap.main",
  "traceId": "trace_...",
  "payload": {}
}
```

### 13.2 Réponse — succès

```json
{
  "id": "cmd_01H...",
  "status": "success",
  "result": {},
  "error": null
}
```

### 13.3 Réponse — erreur

```json
{
  "id": "cmd_01H...",
  "status": "error",
  "result": null,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials",
    "safeMessage": "Identifiant ou mot de passe invalide",
    "retryable": false
  }
}
```

`message` est destiné aux logs internes, `safeMessage` est le seul texte autorisé à atteindre l'utilisateur final (voir [§36](#36-politique-derreurs)).

### 13.4 Invariants du contrat

- `id` unique, généré par l'émetteur, utilisé pour la corrélation et l'anti-rejeu ;
- `expiresAt` court (quelques secondes), toute commande expirée est rejetée sans exécution ;
- `audience` doit correspondre exactement au connecteur ciblé, vérifié avant exécution ;
- `traceId` propagé de bout en bout pour l'observabilité ([§34](#34-observabilité)).

---

## 14. Catalogue des commandes standard

### 14.1 Identité

```txt
identity.resolve
identity.search
identity.getById
identity.getByUsername
identity.getByEmail
identity.getClaims
identity.getGroups
identity.getRoles
```

### 14.2 Authentification

```txt
auth.verifyPassword
auth.verifyMfa
auth.getMfaMethods
auth.startMfa
auth.registerMfa
auth.disableMfa
auth.changePassword
auth.requestPasswordReset
auth.resetPassword
```

### 14.3 OAuth / OIDC

```txt
client.get
client.listAllowedRedirectUris
client.getSecret
client.validateSecret
consent.get
consent.save
consent.revoke
claims.map
```

### 14.4 Sessions

```txt
session.validate
session.revoke
session.revokeAll
```

### 14.5 Audit

```txt
audit.emit
audit.search
```

### 14.6 Administration

```txt
admin.health
admin.testConnection
admin.reloadConfig
```

Ce catalogue est versionné dans `packages/connector-contracts` et constitue la source de vérité partagée entre le cœur Cartulaire et tout connecteur, quel que soit son langage d'implémentation.

---

## 15. OAuth 2.1

OAuth 2.1 est le protocole prioritaire de Cartulaire.

### 15.1 Flows supportés (V1)

```txt
Authorization Code Flow + PKCE
Client Credentials
Refresh Token
Device Authorization Flow
Token Introspection
Token Revocation
```

Volontairement **non supportés** :

```txt
Implicit Flow
Resource Owner Password Credentials
```

### 15.2 Endpoints

```txt
GET  /oauth/authorize
POST /oauth/token
POST /oauth/introspect
POST /oauth/revoke
GET  /oauth/device
POST /oauth/device
```

### 15.3 PKCE obligatoire

PKCE est obligatoire pour :

```txt
clients publics
SPA
applications mobiles
applications desktop
```

Recommandation stricte : `S256` uniquement, `plain` interdit par défaut.

---

## 16. OpenID Connect

### 16.1 Endpoints

Le provider OIDC (`oidc-provider`, via `nest-oidc-provider`) est monté sous le préfixe
`/oidc`. L'identifiant d'émetteur (`CARTULAIRE_OIDC_ISSUER`) **doit inclure** ce préfixe
(ex. `http://localhost:9000/oidc`) afin que la découverte OpenID Connect reste conforme
([OIDC Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)) : le
document est publié à `{issuer}/.well-known/openid-configuration`, soit en développement :

```txt
GET http://localhost:9000/oidc/.well-known/openid-configuration
```

Endpoints OIDC exposés (tous sous `/oidc`) :

```txt
GET  /oidc/.well-known/openid-configuration
GET  /oidc/jwks
GET  /oidc/auth
POST /oidc/token
GET  /oidc/userinfo
POST /oidc/logout
GET  /oidc/session/check
```

### 16.2 Scopes standards

```txt
openid
profile
email
phone
address
offline_access
```

### 16.3 Claims standards

```txt
sub
name
given_name
family_name
preferred_username
email
email_verified
phone_number
phone_number_verified
locale
picture
updated_at
```

### 16.4 Mapping des claims

Cartulaire ne doit jamais savoir *comment* les claims sont stockés côté source. Il interroge systématiquement le daemon ou le microservice via `claims.map` :

```json
{
  "type": "claims.map",
  "payload": {
    "subject": "u_123",
    "scopes": ["openid", "profile", "email"],
    "clientId": "client_web"
  }
}
```

Réponse attendue :

```json
{
  "sub": "u_123",
  "preferred_username": "clement",
  "email": "clement@example.com",
  "email_verified": true
}
```

---

## 17. CAS

CAS est ajouté **après** la stabilisation d'OIDC ([roadmap V2](#43-roadmap)).

### 17.1 Endpoints

```txt
GET  /cas/login
GET  /cas/logout
GET  /cas/validate
GET  /cas/serviceValidate
GET  /cas/p3/serviceValidate
```

### 17.2 Règle d'implémentation

CAS doit réutiliser le moteur d'authentification du cœur Cartulaire, jamais le dupliquer :

```txt
CAS login → session Cartulaire → auth.verifyPassword → ticket CAS signé
```

Les tickets CAS doivent être courts, signés, expirables et **non réutilisables** (consommation unique, anti-rejeu strict).

---

## 18. SAML 2.0

SAML est ajouté **après** CAS ([roadmap V3](#43-roadmap)).

### 18.1 Fonctionnalités

```txt
SAML IdP
Metadata XML
Single Sign-On
Single Logout (optionnel)
Assertions signées
Assertions chiffrées (optionnelles)
Mapping attributaire
```

### 18.2 Endpoints

```txt
GET  /saml/metadata
GET  /saml/sso
POST /saml/sso
GET  /saml/slo
POST /saml/slo
```

### 18.3 Règle d'isolation

SAML doit rester isolé dans `packages/protocol-saml` et ne jamais polluer le cœur OAuth/OIDC, ni en dépendances, ni en complexité conditionnelle dans les contrôleurs partagés.

---

## 19. Sessions

### 19.1 Principe

Cartulaire limite au maximum le stockage serveur de session. Mode recommandé :

```txt
cookie chiffré et signé
TTL court
rotation régulière
SameSite=Lax ou Strict selon le contexte
HttpOnly
Secure
```

### 19.2 Données autorisées en session

La session ne doit **jamais** contenir : mot de passe, secret MFA, token brut superflu, données LDAP complètes, profil complet, attributs sensibles non nécessaires au flux courant.

Elle peut contenir, a minima :

```json
{
  "sid": "sess_...",
  "sub": "user_123",
  "authTime": 1782810000,
  "amr": ["pwd", "totp"],
  "acr": "urn:cartulaire:loa:2"
}
```

### 19.3 Anti-rejeu

Pour les codes OAuth, tickets CAS et assertions temporaires SAML, Cartulaire applique :

- un TTL très court ;
- une signature forte ;
- une audience stricte ;
- un nonce ;
- PKCE (OAuth) ;
- une option d'anti-rejeu en mémoire pour un déploiement mono-instance ;
- une option d'anti-rejeu déléguée à un microservice partagé pour un déploiement multi-instance strict.

---

## 20. Tokens

### 20.1 Access tokens

Deux modes possibles : **JWT signé** ou **token opaque avec introspection**.

Recommandation V1 : **JWT signé `RS256` ou `EdDSA`**.

### 20.2 ID tokens

ID Token OIDC signé, avec les claims standards : `iss`, `sub`, `aud`, `exp`, `iat`, `auth_time`, `nonce`, `acr`, `amr`.

### 20.3 Refresh tokens

```txt
rotation obligatoire
expiration absolue
expiration glissante configurable
révocation possible
hashés si stockage délégué
jamais stockés en clair dans Cartulaire
```

Toute opération nécessitant un état durable de révocation passe par `session.revoke` / `session.validate` auprès du daemon ou d'un microservice — jamais par un stockage interne au cœur Cartulaire.

---

## 21. Gestion des clients OAuth

### 21.1 Deux modes

#### Mode statique

Clients déclarés dans la configuration YAML :

```yaml
clients:
  - id: web-app
    name: Web App
    type: confidential
    redirectUris:
      - https://app.example.com/callback
    scopes:
      - openid
      - profile
      - email
```

#### Mode microservice

Cartulaire interroge dynamiquement le daemon via `client.get` et `client.validateSecret`, utile lorsque les clients OAuth sont eux-mêmes gérés par un système tiers (CMDB, console d'administration interne, etc.).

### 21.2 Champs obligatoires par client

```txt
id
nom
type
redirect URIs
grant types
scopes autorisés
niveau de confiance
méthode d'authentification
```

### 21.3 Redirect URIs

```txt
correspondance exacte obligatoire
wildcard interdit par défaut
localhost autorisé uniquement en environnement dev
HTTP interdit en production sauf localhost
fragments interdits
```

---

## 22. Authentification utilisateur

### 22.1 Flux de login

```txt
GET /login
  ↓ affichage Nunjucks
POST /login
  ↓ auth.verifyPassword
MFA si requis
  ↓ création de session
retour OAuth/OIDC/CAS/SAML
```

### 22.2 Identifiants multiples

Cartulaire accepte plusieurs types d'identifiants (`username`, `email`, `uid`, `matricule`, ou tout identifiant custom), mais la résolution effective reste systématiquement déléguée à `identity.resolve` — le cœur ne fait jamais d'hypothèse sur le format ou le stockage de l'identifiant.

### 22.3 Mot de passe

Le cœur Cartulaire ne vérifie **jamais** lui-même un hash de mot de passe. Il appelle systématiquement `auth.verifyPassword`, ce qui permet à chaque organisation de conserver son propre algorithme de hachage (bcrypt, argon2, ou schéma legacy AD/LDAP) sans jamais l'exposer au cœur.

---

## 23. MFA

### 23.1 Méthodes prévues

```txt
V1 : TOTP, Recovery codes
V2 : WebAuthn / Passkeys, Email OTP (optionnel), SMS OTP (déconseillé mais possible)
```

### 23.2 Règles d'application

Le MFA peut être rendu obligatoire :

- globalement ;
- par client OAuth ;
- par groupe ;
- par niveau de risque (signal du score de risque délégué à un microservice) ;
- désactivé explicitement en environnement de développement.

La décision finale peut être déléguée au microservice via `auth.getMfaMethods`, permettant des politiques fines (ex. MFA obligatoire pour les comptes à privilèges élevés uniquement).

---

## 24. UI / Frontend

### 24.1 Philosophie

Le front doit être léger, rapide, accessible, lisible, sans framework SPA, sans hydratation inutile, navigable au clavier, et sécurisé par défaut.

### 24.2 Stack

```txt
Nunjucks
Tailwind CSS
PostCSS
JavaScript minimal
```

### 24.3 Rôle du JavaScript

JavaScript autorisé uniquement pour :

- améliorer l'UX (afficher/masquer un mot de passe, autofocus, feedback simple) ;
- l'implémentation WebAuthn (V2).

Aucun JavaScript ne doit être **requis** pour : se connecter, accepter un consentement, valider un code MFA, se déconnecter. C'est une exigence d'accessibilité autant que de sécurité (réduction de la surface d'attaque XSS).

### 24.4 Content Security Policy

```txt
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
```

Aucun CDN externe en production — tout asset (police, logo, script) est servi depuis `apps/web`.

---

## 25. Sécurité HTTP

Activés par défaut :

```txt
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Content-Security-Policy
Permissions-Policy
Cross-Origin-Opener-Policy
Cross-Origin-Resource-Policy
```

Cookies :

```txt
HttpOnly
Secure
SameSite=Lax ou Strict
Path strict
TTL court
```

---

## 26. Sécurité daemon / microservices

### 26.1 Authentification service à service

Chaque daemon ou microservice est identifié par :

```txt
serviceId
clé publique
secret ou certificat
audience attendue
permissions
```

### 26.2 Signature des commandes

Chaque commande doit être signée, horodatée, expirée rapidement, liée à une audience précise et à un `traceId`, et validée côté daemon/microservice avant toute exécution.

### 26.3 mTLS

En production sensible, Cartulaire doit supporter le mTLS entre l'API et le daemon/les connecteurs.

### 26.4 Permissions par connecteur

Un connecteur LDAP en lecture seule ne doit jamais pouvoir exécuter `auth.changePassword`, `consent.save` ou `session.revoke`, sauf permission explicitement déclarée :

```yaml
connectors:
  ldap-main:
    url: https://ldap-connector.internal:8443
    audience: connector.ldap.main
    permissions:
      - identity.resolve
      - identity.getGroups
      - auth.verifyPassword
```

Cette liste blanche de permissions est vérifiée à la fois côté daemon (avant transmission) et côté connecteur (avant exécution), en défense en profondeur.

---

## 27. Connecteur LDAP

### 27.1 Technologie Node.js — `ldapts`

Choix retenu pour le connecteur LDAP officiel Node : **ldapts**.

Raisons : librairie moderne, TypeScript-friendly, adaptée aux services Node, plus propre que les anciennes bibliothèques LDAP historiques, compatible LDAP standard et Active Directory.

### 27.2 Commandes supportées

```txt
identity.resolve
identity.getByUsername
identity.getByEmail
identity.getGroups
auth.verifyPassword
auth.changePassword (optionnel)
```

### 27.3 Exemple de configuration

```yaml
ldap:
  url: ldaps://ldap.example.local:636
  bindDn: cn=cartulaire,ou=services,dc=example,dc=local
  bindPasswordEnv: LDAP_BIND_PASSWORD
  baseDn: dc=example,dc=local
  userFilter: "(&(objectClass=user)(sAMAccountName={{identifier}}))"
  groupFilter: "(member={{dn}})"
```

---

## 28. Connecteur MongoDB

### 28.1 Technologie Node.js — `Mongoose`

Choix retenu : **Mongoose**, cohérent avec l'écosystème Node/NestJS, schémas explicites, middleware disponible, typage correct avec TypeScript, parfaitement adapté à un connecteur d'exemple pédagogique.

### 28.2 Commandes supportées

```txt
identity.resolve
identity.getById
identity.getClaims
identity.getGroups
auth.verifyPassword
consent.get
consent.save
session.revoke
```

### 28.3 Règle

Le connecteur MongoDB reste un **exemple parmi d'autres**. Cartulaire ne doit jamais dépendre de Mongoose dans son cœur — uniquement dans `connectors/mongo-node`.

---

## 29. Connecteur SQL

### 29.1 Technologie recommandée — `Kysely`

Pour le connecteur SQL officiel, **Kysely** est recommandé, avec les dialectes :

```txt
pg pour PostgreSQL
mysql2 pour MySQL / MariaDB
better-sqlite3 pour SQLite de développement
```

### 29.2 Pourquoi Kysely plutôt qu'un ORM complet

Kysely convient particulièrement bien à un microservice NestJS d'identité car il est léger, typé, proche du SQL natif, moins intrusif qu'un ORM complet, simple à injecter dans NestJS, facile à isoler dans un connecteur, et compatible multi-dialectes. Pour un connecteur d'identité, on veut généralement maîtriser précisément les requêtes émises plutôt que les déléguer à une couche d'abstraction lourde — Kysely répond à ce besoin sans sacrifier le typage.

### 29.3 Commandes supportées

```txt
identity.resolve
identity.getById
identity.getClaims
identity.getGroups
auth.verifyPassword
consent.get
consent.save
audit.emit
```

---

## 30. Connecteurs Python

Les connecteurs Python permettent aux administrateurs système d'écrire rapidement des intégrations, en particulier dans des environnements déjà fortement outillés en Python (infra, data, scripts d'exploitation existants).

```txt
LDAP    → ldap3
SQL     → SQLAlchemy Core, asyncpg (PostgreSQL haute performance si besoin)
MongoDB → pymongo
API     → FastAPI, httpx, pydantic
```

Les connecteurs Python respectent exactement le même contrat de commande ([§13](#13-contrat-de-commande)) que les connecteurs Node — seule l'implémentation change.

---

## 31. SDK connecteur

Un SDK officiel est fourni pour chaque langage supporté nativement, afin de standardiser la validation de signature, le parsing des commandes et la construction des réponses.

### 31.1 SDK Node.js — `@cartulaire/connector-sdk`

```ts
createConnectorServer()
defineCommand()
verifyCartulaireSignature()
replySuccess()
replyError()
```

### 31.2 SDK Python — `cartulaire-connector-sdk`

```py
create_connector_server()
define_command()
verify_cartulaire_signature()
reply_success()
reply_error()
```

Tout langage tiers respectant le contrat de commande HTTP signé reste compatible sans SDK officiel — celui-ci est un confort, pas une dépendance obligatoire du protocole.

---

## 32. Configuration

### 32.1 Formats supportés

```txt
YAML
variables d'environnement
secrets montés en fichiers
```

### 32.2 Exemple complet

```yaml
server:
  publicUrl: https://auth.example.com
  trustProxy: true

security:
  cookieSecretEnv: CARTULAIRE_COOKIE_SECRET
  tokenSigningKeyPath: /run/secrets/oidc_private_key.pem
  tokenSigningAlg: EdDSA

ui:
  productName: Cartulaire
  logo: /assets/logo.svg
  background: /assets/background.svg
  theme:
    primary: "#A824FC"
    primaryHover: "#7A0CE0"
    primaryDark: "#4800B4"

protocols:
  oauth:
    enabled: true
  oidc:
    enabled: true
  cas:
    enabled: false
  saml:
    enabled: false

connectors:
  main:
    type: http
    url: https://connector-main.internal:8443/commands
    audience: connector.main
    auth:
      mode: signed-jwt
      keyId: cartulaire-main
    permissions:
      - identity.resolve
      - identity.getClaims
      - identity.getGroups
      - auth.verifyPassword
      - consent.get
      - consent.save

clients:
  - id: demo-web
    name: Demo Web
    type: confidential
    secretEnv: DEMO_WEB_SECRET
    redirectUris:
      - https://demo.example.com/callback
    grants:
      - authorization_code
      - refresh_token
    scopes:
      - openid
      - profile
      - email
```

Toute configuration doit être validée au démarrage via un schéma Zod (`packages/config`), avec échec rapide (*fail-fast*) et message d'erreur explicite en cas d'incohérence.

---

## 33. CLI

Cartulaire fournit une CLI unique, installée avec le paquet `cartulaire` :

```txt
cartulaire dev
cartulaire start
cartulaire daemon
cartulaire check-config
cartulaire generate-keys
cartulaire rotate-keys
cartulaire test-connector
cartulaire discover
cartulaire health
```

Exemples d'usage :

```bash
cartulaire generate-keys --alg EdDSA --out ./secrets
cartulaire check-config ./cartulaire.yml
cartulaire daemon --config ./daemon.yml
cartulaire test-connector main
```

---

## 34. Observabilité

### 34.1 Logs

Logs structurés JSON via **Pino**. Chaque requête contient : `traceId`, `requestId`, `clientId`, `subject` (si disponible), `protocol`, connecteur appelé, durée, statut.

**Jamais** présents dans les logs : mot de passe, token complet, refresh token, secret client, code MFA, assertion SAML complète, cookie de session.

### 34.2 Metrics

Compatible Prometheus :

```txt
cartulaire_http_requests_total
cartulaire_oauth_authorizations_total
cartulaire_token_issued_total
cartulaire_connector_latency_ms
cartulaire_connector_errors_total
cartulaire_login_failures_total
cartulaire_mfa_challenges_total
```

### 34.3 Tracing

OpenTelemetry, avec spans couvrant : requête HTTP, flux OAuth complet, commande connecteur, génération de token, rendu de template.

---

## 35. Audit

Cartulaire produit des événements d'audit dédiés, distincts des logs techniques :

```txt
login.success
login.failure
mfa.success
mfa.failure
oauth.consent.accepted
oauth.token.issued
oauth.token.revoked
session.revoked
connector.error
admin.config.reload
```

L'audit peut être loggé localement, envoyé à un microservice dédié, transmis à un SIEM, ou émis en JSON sur stdout — au choix de l'administrateur, configurable indépendamment des logs applicatifs.

---

## 36. Politique d'erreurs

### 36.1 Erreur utilisateur

Ne jamais révéler à l'utilisateur final : si un compte existe, si un email est valide, si seul le mot de passe est incorrect, si seul le code MFA est incorrect.

Message générique imposé : *« Identifiant ou mot de passe invalide. »*

### 36.2 Erreur technique

Page d'erreur minimale affichée :

```txt
Une erreur est survenue.
Code de suivi : trace_xxx
```

Les détails techniques ne vont **que** dans les logs, jamais dans la réponse HTTP visible.

---

## 37. Rate limiting

Rate limiting configurable, ciblant prioritairement :

```txt
/login
/oauth/token
/oauth/device
/oidc/userinfo
/cas/login
/saml/sso
```

Clés de limitation possibles : IP, identifiant hashé, `clientId`, `sessionId`.

En mode stateless strict, le rate limiting avancé (distribué, multi-instance) peut être délégué à un reverse proxy, un microservice dédié, une gateway, ou tout composant externe choisi par l'administrateur — cohérent avec le principe général de non-rétention d'état du cœur.

---

## 38. Reverse proxy

Cartulaire doit rester compatible avec :

```txt
Traefik
Nginx
Caddy
HAProxy
Kubernetes Ingress
```

Les headers de confiance (`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`) ne sont pris en compte que si `server.trustProxy` est explicitement activé en configuration.

---

## 39. Déploiement

### 39.1 Images Docker officielles

```txt
cartulaire/api
cartulaire/daemon
cartulaire/connector-ldap-node
cartulaire/connector-sql-node
cartulaire/connector-mongo-node
cartulaire/connector-mock
```

### 39.2 Docker Compose minimal

```yaml
services:
  cartulaire-api:
    image: cartulaire/api:latest
    ports:
      - "3000:3000"
    environment:
      CARTULAIRE_CONFIG: /config/cartulaire.yml
      CARTULAIRE_COOKIE_SECRET: change-me
    volumes:
      - ./config:/config:ro
      - ./secrets:/secrets:ro
    depends_on:
      - cartulaire-daemon

  cartulaire-daemon:
    image: cartulaire/daemon:latest
    environment:
      CARTULAIRE_DAEMON_CONFIG: /config/daemon.yml
      CONNECTOR_SECRET: change-me
    volumes:
      - ./config:/config:ro
      - ./scripts:/scripts:ro
```

Des variantes Kubernetes (Helm chart minimal) et Traefik/Nginx complètes vivent dans `examples/`.

---

## 40. Tests

### 40.1 Tests unitaires

```txt
packages/core
packages/protocol-oauth
packages/protocol-oidc
packages/connector-contracts
packages/crypto
```

### 40.2 Tests d'intégration

```txt
login password
login MFA
authorization code + PKCE
refresh token rotation
client credentials
device code
userinfo
revocation
introspection
connector unavailable
invalid connector signature
expired command
```

### 40.3 Tests end-to-end (Playwright)

```txt
page login
consentement
MFA TOTP
logout
erreurs OAuth
```

---

## 41. Sécurité du code

Règles obligatoires, vérifiées en CI :

```txt
TypeScript strict
pas de `any` sans justification documentée
validation Zod sur toutes les entrées
échappement HTML par défaut (Nunjucks autoescape activé)
CSP stricte
dépendances auditées (npm audit / osv-scanner en CI)
pas de secret dans les logs
pas de CDN en production
pas de eval
pas de Function dynamique
pas de templates utilisateur non maîtrisés
```

---

## 42. Packages npm internes

```txt
@cartulaire/core
@cartulaire/protocol-oauth
@cartulaire/protocol-oidc
@cartulaire/protocol-cas
@cartulaire/protocol-saml
@cartulaire/connector-sdk
@cartulaire/connector-contracts
@cartulaire/crypto
@cartulaire/config
@cartulaire/logger
@cartulaire/audit
@cartulaire/ui
```

Convention cohérente avec les bibliothèques déjà publiées sous le scope `@tacxou` : chaque package porte un `README` autonome, un changelog semver, et des exports typés stricts.

---

## 43. Roadmap

### V0 — Prototype

Objectif : valider l'architecture de bout en bout.

- monorepo opérationnel ;
- API NestJS minimale ;
- daemon minimal ;
- rendu Nunjucks + Tailwind ;
- connecteur mock ;
- login simple fonctionnel ;
- appel microservice signé de bout en bout ;
- configuration YAML validée ;
- logs structurés.

### V1 — OAuth / OIDC stable

- Authorization Code + PKCE ;
- Client Credentials, Refresh Token ;
- JWKS, Discovery OIDC, UserInfo ;
- écran de consentement ;
- connecteurs LDAP, SQL, Mongo (Node) ;
- SDK Node ;
- Docker Compose complet ;
- documentation de déploiement.

### V1.5 — Sécurité avancée

- MFA TOTP ;
- audit complet ;
- rate limiting ;
- OpenTelemetry ;
- rotation des clés de signature ;
- durcissement CSP ;
- suite de tests E2E.

### V2 — CAS

- CAS login, `serviceValidate` ;
- proxy ticket optionnel ;
- mapping attributaire ;
- compatibilité applications legacy.

### V3 — SAML

- SAML IdP, métadonnées ;
- assertions signées, chiffrement optionnel ;
- Single Logout optionnel ;
- mapping attributaire avancé.

---

## 44. Règles de base du projet

1. Le cœur Cartulaire ne lit ni n'écrit dans aucune base de données.
2. Toute donnée externe passe par un microservice sécurisé ou par le daemon.
3. OAuth/OIDC passe avant CAS et SAML, dans cet ordre, sans exception.
4. Le front reste rendu côté serveur, léger et sécurisé.
5. Aucun framework SPA n'est autorisé pour les pages critiques d'authentification.
6. JavaScript reste optionnel, sauf besoin technique fort (ex. WebAuthn).
7. Chaque connecteur est isolé, remplaçable et testable indépendamment.
8. Chaque commande microservice est signée, horodatée et limitée dans le temps.
9. Les erreurs ne divulguent jamais d'information sensible à l'utilisateur final.
10. La configuration reste lisible et modifiable par un administrateur système, sans outil tiers.
11. Les secrets ne sont jamais présents en clair dans le dépôt.
12. Tout flux OAuth/OIDC est couvert par des tests E2E.
13. Les protocoles legacy CAS et SAML restent strictement séparés du cœur OIDC.
14. Le projet reste auto-hébergeable sans dépendance cloud obligatoire.
15. Le code reste compréhensible, documenté et maintenable par une petite équipe.

---

## 45. Positionnement concurrentiel

Cartulaire se positionne comme :

> Un serveur OIDC open source, léger, sécurisé, scriptable et orienté sysadmin.

### Par rapport à Keycloak

- plus léger, moins monolithique ;
- pas de base de données imposée ;
- pas d'UI d'administration lourde obligatoire ;
- connecteurs scriptables dans n'importe quel langage ;
- architecture microservice-first dès la conception, pas en surcouche.

### Par rapport à Authentik / Zitadel

- moins « plateforme complète », plus orienté adaptateurs custom ;
- plus simple à auto-héberger pour une petite équipe ;
- séparation cœur/stockage plus stricte et non contournable par design.

---

## 46. Glossaire

| Terme | Définition |
|---|---|
| **Cœur** | Le code de `apps/api`, `apps/web` et `packages/*` — ne touche jamais une base de données. |
| **Daemon** | Processus pont (`apps/daemon`) qui reçoit les commandes signées et les route vers le bon connecteur. |
| **Connecteur** | Implémentation d'accès à une source de données réelle (`connectors/*`), respectant le contrat de commande. |
| **Commande** | Unité d'échange entre l'API et un connecteur (`POST /commands`), typée et cataloguée dans `connector-contracts`. |
| **Audience** | Identifiant du connecteur destinataire d'une commande, vérifié à la signature. |
| **ACR / AMR** | Claims OIDC standards décrivant respectivement le niveau et la méthode d'authentification utilisés. |
| **Consentement** | Accord explicite de l'utilisateur sur les scopes demandés par un client OAuth, stocké via le connecteur, jamais dans le cœur. |

---

## 47. Résumé exécutif

Cartulaire est un serveur d'identité open source construit autour de NestJS, d'OAuth 2.1 et d'OpenID Connect, complété progressivement par CAS puis SAML 2.0.

Il ne possède aucune base de données et ne lit ni n'écrit jamais directement dans un système de stockage : toutes les opérations métier — vérification de mot de passe, résolution d'identité, gestion de groupes, consentement — sont déléguées à des microservices sécurisés ou à un daemon d'exécution, écrits dans le langage choisi par l'administrateur système.

Le front est rendu côté serveur avec Nunjucks et Tailwind CSS, avec un minimum de JavaScript, afin de réduire au maximum la surface d'attaque sur les pages critiques d'authentification.

Le projet fournit des connecteurs d'exemple LDAP (`ldapts` / `ldap3`), SQL (`Kysely` / `SQLAlchemy`) et MongoDB (`Mongoose` / `pymongo`) en Node.js et Python, tout en restant ouvert à n'importe quelle implémentation tierce compatible avec le contrat de commande Cartulaire.
