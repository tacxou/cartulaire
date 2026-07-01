# GitHub Copilot — Cartulaire

## Messages de commit

Utiliser [Conventional Commits](https://www.conventionalcommits.org/) comme défini dans
[`docs/conventions/conventional-commits.md`](../docs/conventions/conventional-commits.md).

Format : `<type>(<scope>): <description>` — anglais, impératif, sujet ≤ 72 caractères.

Scopes : `api` · `daemon` · `web` · `core` · `connector-contracts` · `connector-sdk` · `crypto` · `config` · `logger` · `connectors` · `deps` · `docker` · `ci` · `root`.

Proposer des messages atomiques ; ne pas committer automatiquement.

## Versionnement

SemVer 2.0.0 **stricte** (`X.Y.Z`) : `fix` → PATCH, `feat` → MINOR, breaking → MAJOR.

## Architecture

Le cœur Cartulaire ne touche jamais une base de données. Voir `SPEC.md` §10 et `CLAUDE.md`.
