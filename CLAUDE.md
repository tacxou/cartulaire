# CLAUDE.md — Règles du projet Cartulaire

Ce fichier fait foi pour toute contribution de Claude Code sur ce dépôt. Les règles
ci-dessous sont **impératives** et priment sur les habitudes par défaut.

Cartulaire est un serveur d'identité open source **OAuth 2.1 / OIDC first**, sans base de
données imposée, orchestrant des microservices sécurisés via un daemon. Monorepo
Yarn workspaces + Turbo.

---

## 0. Règle absolue — Git

🚫 **Claude ne doit JAMAIS `git commit` ni `git push` de lui-même.**

- Préparer les modifications (édition de fichiers), proposer un message de commit si utile,
  puis **laisser l'utilisateur committer et pousser lui-même**.
- Cette règle s'applique même si l'utilisateur a précédemment approuvé un commit : chaque
  commit/push reste une action manuelle de l'utilisateur.
- **Format des messages** : Conventional Commits 1.0.0 — voir
  `docs/conventions/conventional-commits.md` (types, scopes monorepo, exemples).
  Sujet en anglais : `type(scope): description impérative`, ≤ 72 caractères, sans point final.
- **Versionnement** : SemVer 2.0.0 **stricte** (`MAJOR.MINOR.PATCH`) — même référence ;
  signaler le bump attendu (`PATCH` / `MINOR` / `MAJOR`) quand le commit le justifie.

---

## 0 bis. Règle absolue — Serveur

🚫 **Claude ne doit JAMAIS démarrer le serveur de dev de lui-même** (`yarn start:dev`,
`nest start --watch`, ou tout équivalent).

- Le serveur de dev est lancé et géré **par l'utilisateur**. Partir du principe qu'il
  tourne déjà ; ne pas en démarrer un nouveau pour vérifier un rendu.
- Pour valider une modification : éditer le code, puis demander à l'utilisateur de vérifier,
  ou s'appuyer sur lint + build + tests. Ne pas contourner en ouvrant une instance parallèle.

---

## 1. Arborescence du dépôt

```
cartulaire/
├── apps/
│   ├── api/               # Cœur HTTP : OAuth/OIDC, Nunjucks, interaction — ne touche jamais une DB
│   ├── daemon/            # Pont sécurisé : reçoit les commandes signées, route vers les connecteurs
│   └── web/               # (futur) pages SSR légères
├── packages/              # Packages partagés @cartulaire/*
│   ├── core/              # Client de commandes, logique transverse
│   ├── connector-contracts/
│   ├── connector-sdk/
│   ├── crypto/
│   ├── config/
│   └── logger/
├── connectors/            # Connecteurs autonomes (mock, ldap, sql, mongo…)
├── docs/                  # Documentation projet
├── SPEC.md                # Spécification technique de référence
├── turbo.json
└── tsconfig.base.json
```

### Détail `apps/api/src` (NestJS)

```
src/
├── _common/               # Briques transverses NON-module Nest (convention underscore)
├── oidc-config/           # Configuration oidc-provider
├── interaction/           # Pages d'interaction OAuth (login, consent…)
├── clients/               # Clients OAuth (config YAML)
├── settings/              # Paramètres runtime
├── storage/               # Cache session (LRU / Redis — pas de DB métier)
└── jwks/                  # Clés de signature
```

---

## 2. Vérifications OBLIGATOIRES en fin de modification

À la fin de **toute** modification de code, avant de présenter le travail comme
terminé, lancer et faire passer au vert :

1. **ESLint** :
   ```bash
   yarn lint
   # ou par workspace :
   yarn workspace @cartulaire/api lint
   yarn workspace @cartulaire/daemon lint
   ```
2. **Build** du workspace touché :
   ```bash
   yarn build
   # ou ciblé :
   yarn workspace @cartulaire/api build
   ```

Règles : ne jamais contourner un hook ni un échec (`--no-verify` interdit). Si un
check échoue, corriger la cause racine. Une feature n'est « terminée » que lorsque
lint + build passent au vert.

---

## 3. Règles BACK (`apps/api`, `apps/daemon` — NestJS / TypeScript)

Respecter strictement les conventions TypeScript et NestJS.

**Nommage**

- Fonctions / méthodes / variables : `camelCase`
- Classes / décorateurs / types / interfaces : `PascalCase`
- Fichiers : `kebab-case` avec suffixe de rôle Nest :
  `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.dto.ts`, `*.function.ts`…

**Convention underscore**

- Un dossier préfixé par `_` n'est **PAS** un sous-module Nest : c'est un regroupement
  technique transverse (briques réutilisables, sans `*.module.ts` propre).
  - ex. `_common/` (abstracts, helpers…).
- Les vrais modules Nest (avec `*.module.ts`) vivent sans underscore.

**Style**

- TypeScript strict, pas de `any` (ESLint `@typescript-eslint/no-explicit-any`: error).
- Injection de dépendances Nest, un fichier = une responsabilité.
- Valider les entrées aux frontières (DTO + class-validator / Zod).
- **Imports** : `*Service`, DTO (`*Dto`) et modules Nest en **import valeur** (DI +
  `emitDecoratorMetadata`) ; `import type` pour les types purs uniquement.

---

## 4. Règle absolue — Architecture (SPEC §10 et §44)

Le cœur Cartulaire (`apps/api`, `packages/*`) **ne lit ni n'écrit jamais** dans une base
de données, un annuaire LDAP, MongoDB, SQL ou tout système de stockage externe.

- Toute opération métier (identité, mot de passe, groupes, consentement) passe par le
  **daemon** et les **connecteurs** via le contrat `@cartulaire/connector-contracts`.
- Chaque commande est **signée, horodatée et limitée dans le temps**.
- Les erreurs ne divulguent **jamais** d'information sensible à l'utilisateur final.
- OAuth/OIDC passe **avant** CAS et SAML, dans cet ordre, sans exception.

---

## 5. Règles FRONT (Nunjucks + Tailwind)

- Rendu **côté serveur** (Nunjucks) — pas de SPA lourde sur les pages critiques d'authentification.
- **JavaScript minimal** — optionnel sauf besoin technique fort (ex. WebAuthn).
- **Content Security Policy stricte** — pas de CDN externe pour les assets de marque.
- Vues dans `apps/api/views/` (layouts, pages, partials).

---

## 6. Stack imposée

| Domaine | Stack imposée |
|---------|---------------|
| **API** | NestJS · TypeScript · oidc-provider · jose · Zod · Nunjucks |
| **Daemon** | NestJS · TypeScript · `@cartulaire/crypto` |
| **Packages** | TypeScript strict · scope `@cartulaire/*` |
| **Connecteurs** | Node.js ou Python · contrat `connector-contracts` |

Ne pas introduire d'ORM (Prisma, TypeORM, Mongoose), de client LDAP ou de driver SQL dans
`apps/api` ou `packages/*` sans validation explicite de l'utilisateur — c'est contraire
au principe fondamental du projet.

---

## 7. Connecteurs (`connectors/*`)

- Chaque connecteur est un workspace autonome, isolé, remplaçable et testable indépendamment.
- Respecter le contrat de commande défini dans `packages/connector-contracts`.
- Le connecteur `mock/` sert au développement et à la démo.
- Les secrets ne sont **jamais** présents en clair dans le dépôt.

---

## 8. Principes de contribution

1. Minimiser le scope — diff le plus simple qui résout le problème.
2. Réutiliser les abstractions existantes (`AbstractService`, `connector-contracts`, adapters storage).
3. Suivre les conventions du code environnant (nommage, imports, structure).
4. Ne pas ajouter de tests triviaux ni de commentaires évidents.
5. Ne pas créer de documentation non demandée (README, fichiers markdown) sauf demande explicite.
6. La configuration reste lisible et modifiable par un administrateur système (YAML).
