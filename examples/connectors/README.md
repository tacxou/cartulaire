# Connecteurs d'exemple Cartulaire

Ces connecteurs sont des **implémentations de référence** que vous, administrateur
système, êtes invité à **copier, modifier et adapter** à votre source d'identité.
Ils respectent tous le [contrat de commande Cartulaire](../../SPEC.md#13-contrat-de-commande) :
un unique endpoint `POST /commands` recevant des commandes **signées, horodatées et
expirables**, et renvoyant une réponse normalisée.

> Ce dossier `examples/` ne fait **pas** partie du monorepo (ni du build Turbo).
> Chaque connecteur est autonome : vous l'installez et le lancez indépendamment.

## Choisir son connecteur

| Dossier | Langage | Source | Librairie |
|---|---|---|---|
| [`ldap-node`](./ldap-node) | Node.js | LDAP / Active Directory | `ldapts` |
| [`sql-node`](./sql-node) | Node.js | PostgreSQL / MySQL / SQLite | `kysely` |
| [`mongo-node`](./mongo-node) | Node.js | MongoDB | `mongoose` |
| [`ldap-python`](./ldap-python) | Python | LDAP / Active Directory | `ldap3` + `FastAPI` |
| [`sql-python`](./sql-python) | Python | SQL | `SQLAlchemy` + `FastAPI` |
| [`mongo-python`](./mongo-python) | Python | MongoDB | `pymongo` + `FastAPI` |

## Le contrat en bref

Le daemon (ou le cœur) envoie :

```http
POST /commands
Content-Type: application/json
X-Cartulaire-Signature: <hmac-sha256 hex>
X-Cartulaire-Timestamp: <epoch ms>

{ "id", "type", "issuedAt", "expiresAt", "issuer", "audience", "traceId", "payload" }
```

La **signature** est un HMAC-SHA256 (hex) du secret partagé sur la chaîne canonique :

```
timestamp . id . type . audience . body
```

où `body` est le corps JSON exact reçu. Le connecteur doit, **avant toute exécution** :

1. vérifier la signature et la fraîcheur de l'horodatage (fenêtre courte, ex. 5 s) ;
2. vérifier que l'`audience` correspond à la sienne ;
3. vérifier que `type` est dans sa **liste blanche** de permissions ;
4. exécuter, puis répondre `{ id, status: "success", result }` ou
   `{ id, status: "error", error: { code, message, safeMessage, retryable } }`.

Les exemples Node délèguent les points 1–4 au SDK `@cartulaire/connector-sdk`.
Les exemples Python implémentent la vérification à la main (le SDK est un confort,
pas une obligation — tout langage respectant le contrat est compatible, §31).

## Sécurité

- Le **secret** (`CARTULAIRE_*_SECRET`) doit être identique côté daemon et connecteur,
  et provenir d'une variable d'environnement / d'un secret monté — **jamais** en clair.
- N'accordez au connecteur que les commandes dont il a besoin (liste blanche, §26.4).
  Un connecteur LDAP en lecture seule ne doit pas exposer `auth.changePassword`.
- En production, préférez mTLS entre daemon et connecteur (§26.3).
