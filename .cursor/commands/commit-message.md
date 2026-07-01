# Générer un message de commit (Conventional Commits)

Analyse **uniquement les fichiers stagés** (`git diff --cached`). Si rien n'est stagé, le signaler et s'arrêter.

## Conventions

Suivre strictement `docs/conventions/conventional-commits.md` :

- Format : `type(scope): description` — anglais, impératif, sans point final
- Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Scopes monorepo : `api`, `daemon`, `web`, `core`, `connector-contracts`, `connector-sdk`, `crypto`, `config`, `logger`, `connectors`, `deps`, `docker`, `ci`, `root` — **enum strict commitlint** ; jamais `scripts`, `release`, `makefile`, etc. (omis seulement si transversal)
- Breaking : `type(scope)!:` ou pied de page `BREAKING CHANGE:`
- SemVer stricte : indiquer le bump attendu (`PATCH` / `MINOR` / `MAJOR`) si `feat`, `fix` ou breaking

## Sortie

1. **Message** — sujet (+ corps optionnel si le *pourquoi* n'est pas évident)
2. **Bump SemVer** — par workspace touché, si applicable
3. **Commande** prête à copier-coller :

```bash
git commit -m "type(scope): description"
```

Ne **pas** exécuter `git commit` ni `git push` sauf demande explicite.

Le hook Husky + commitlint rejettera tout message non conforme.
