# Conventions de messages de commit — Cartulaire

> Source de vérité partagée par Cursor, Claude Code, GitHub Copilot, Codex et tout agent IA du dépôt.
> Commits : [Conventional Commits 1.0.0](https://www.conventionalcommits.org/fr/v1.0.0/).
> Versions : [Semantic Versioning 2.0.0](https://semver.org/lang/fr/) (**stricte**).

## Format

```
<type>(<scope>): <description>

[corps optionnel — paragraphes séparés par une ligne vide]

[pied de page optionnel]
```

- **Langue** : anglais (sujet et corps).
- **Sujet** : impératif, minuscule après le `:`, sans point final, **≤ 72 caractères**.
- **Corps** : expliquer le *pourquoi*, pas seulement le *quoi* ; une ligne ≤ 100 caractères.
- **Pied de page** : références issues/PR, co-auteurs, breaking changes.

## Types autorisés

| Type | Usage |
|------|--------|
| `feat` | Nouvelle fonctionnalité visible (API, UI, protocole, connecteur) |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement (README, SPEC, commentaires de doc) |
| `style` | Formatage, lint sans changement de logique |
| `refactor` | Restructuration sans feat ni fix |
| `perf` | Amélioration de performance |
| `test` | Ajout ou correction de tests |
| `build` | Dépendances, Turbo, Docker, scripts de build |
| `ci` | GitHub Actions, hooks CI, intégration continue |
| `chore` | Maintenance diverse (config outillage) |
| `revert` | Annulation d'un commit précédent |

## Scopes (monorepo)

Utiliser **un seul scope** par commit, celui du workspace principal touché :

| Scope | Périmètre |
|-------|-----------|
| `api` | `apps/api/` |
| `daemon` | `apps/daemon/` |
| `web` | `apps/web/` |
| `core` | `packages/core/` |
| `connector-contracts` | `packages/connector-contracts/` |
| `connector-sdk` | `packages/connector-sdk/` |
| `crypto` | `packages/crypto/` |
| `config` | `packages/config/` |
| `logger` | `packages/logger/` |
| `connectors` | `connectors/*` |
| `deps` | mises à jour de dépendances multi-workspaces |
| `docker` | `Dockerfile`, compose, images |
| `ci` | `.github/`, workflows |
| `root` | racine monorepo (`turbo.json`, `.eslintrc.js`, règles IA) |

Omettre le scope si le changement est réellement transversal et ne se rattache à aucun périmètre ci-dessus.

## Versionnement — SemVer stricte

Cartulaire applique **Semantic Versioning 2.0.0 sans dérogation** : toute version publiée
(tag Git, `package.json`, release notes) est **`MAJOR.MINOR.PATCH`** (trois entiers non négatifs).

| Règle | Détail |
|-------|--------|
| Format | `X.Y.Z` uniquement — pas de `v1.2`, pas de quatrième segment libre |
| `MAJOR` | Incrément si changement **breaking** (API publique, contrat partagé, schéma…) |
| `MINOR` | Incrément si **feat** rétrocompatible ; remise à zéro de `PATCH` |
| `PATCH` | Incrément si **fix** rétrocompatible |
| Pré-release | Suffixe explicite uniquement : `1.2.0-alpha.1`, `1.2.0-rc.1` |
| Phase `0.y.z` | Développement initial : `MINOR` peut introduire des breaks (SemVer §4) |

### Lien commits → bump de version

| Commit(s) depuis la dernière release | Bump |
|--------------------------------------|------|
| `fix` (seul ou dominant) | `PATCH` |
| `feat` (sans breaking) | `MINOR` |
| `BREAKING CHANGE` ou `type(scope)!:` | `MAJOR` |
| `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build` | **Aucun** bump de version produit |

En cas de mix (ex. `feat` + `fix` dans la même release), appliquer le **segment le plus élevé**.

### Périmètres versionnés (monorepo)

Chaque unité publishable/versionnable évolue **indépendamment** :

- racine (`package.json`)
- `apps/api`, `apps/daemon`, `apps/web`
- chaque package `@cartulaire/*`
- chaque connecteur `connectors/*`

Les agents IA **signalent** le bump SemVer attendu lorsqu'ils proposent un message avec `feat`, `fix` ou breaking change.

## Enforcement (commitlint + Husky)

Chaque commit local est validé par **commitlint** via le hook Husky `.husky/commit-msg` :

```bash
yarn commitlint --edit .git/COMMIT_EDITMSG   # test manuel sur un fichier message
echo "feat(api): add login page" | yarn commitlint
```

- Config : `commitlint.config.js` (extends `@commitlint/config-conventional` + scopes Cartulaire).
- Activation : `yarn install` exécute `prepare` → enregistre les hooks Git.
- Génération assistée Cursor : commande `/commit-message` (`.cursor/commands/commit-message.md`).
- Contournement déconseillé : `git commit --no-verify` (réservé aux cas exceptionnels).

## Breaking changes

- Sujet : `feat(api)!: remove legacy auth endpoint`
- Ou pied de page :
  ```
  BREAKING CHANGE: JWT payload no longer includes orgId.
  ```

## Pieds de page courants

```
Refs: #42
Closes: #42
Co-authored-by: Name <email@example.com>
```

## Exemples (Cartulaire)

```
feat(api): add OIDC interaction consent page
```

```
fix(daemon): enforce command signature expiry
```

```
refactor(core): simplify command client envelope parsing
```

```
build(deps): bump nestjs to 10.4
```

```
docs(root): add AI agent rules and commit conventions
```

```
chore(connectors): add mock connector user fixtures
```

## Règles pour les agents IA

1. **Proposer** un message conforme ; ne pas exécuter `git commit` ni `git push` sauf demande explicite de l'utilisateur (voir `CLAUDE.md` §0).
2. **Un commit = une intention** : ne pas mélanger feat API + refactor daemon ; scinder en commits atomiques si nécessaire.
3. **Éviter** : `WIP`, `fix stuff`, `update`, sujets vagues sans type/scope.
4. **Revert** : `revert(<scope>): <sujet du commit annulé>` + corps avec hash court (`Refs: abc1234`).
5. **SemVer** : indiquer le bump attendu (`PATCH` / `MINOR` / `MAJOR`) quand le commit le justifie ; ne jamais proposer une version hors format `X.Y.Z`.

## Anti-exemples

```
❌ Add login page
❌ fix bug
❌ WIP: auth stuff
❌ feat(api,daemon): huge mixed commit
✅ feat(api): add login page with consent flow
```
