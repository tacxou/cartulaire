# Instructions agents IA — Cartulaire

Fichier lu par Cursor Agent, Codex, Copilot Agent et assistants similaires.

## Messages de commit

Suivre **Conventional Commits 1.0.0** — spécification complète :
[`docs/conventions/conventional-commits.md`](docs/conventions/conventional-commits.md)

Résumé :

```
<type>(<scope>): <description>
```

- Anglais, impératif, sujet ≤ 72 caractères, sans point final.
- Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scopes monorepo : `api`, `daemon`, `web`, `core`, `connector-contracts`, `connector-sdk`, `crypto`, `config`, `logger`, `connectors`, `deps`, `docker`, `ci`, `root`.
- Proposer le message ; ne pas `git commit` / `git push` sans demande explicite.

## Versionnement

**SemVer 2.0.0 stricte** : format `X.Y.Z` ; `fix` → PATCH, `feat` → MINOR, breaking → MAJOR. Détails dans la spec ci-dessus.

## Règles métier

Le cœur Cartulaire ne lit ni n'écrit dans aucune base de données. Voir [`SPEC.md`](SPEC.md) §10 et §44.

## Enforcement

Hook Husky + commitlint rejette les messages non conformes. Génération assistée : commande Cursor `/commit-message`.

Charte projet complète : [`CLAUDE.md`](CLAUDE.md).
