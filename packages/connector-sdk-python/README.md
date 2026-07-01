# cartulaire-connector-sdk (Python)

SDK officiel pour écrire un **connecteur Cartulaire** en Python — le pendant de
`@cartulaire/connector-sdk` (Node). Il prend en charge le [contrat de commande
signé](../../SPEC.md#13-contrat-de-commande) : vérification de signature HMAC,
fraîcheur de l'horodatage, audience, liste blanche de permissions, et réponses
normalisées. **Zéro dépendance** (bibliothèque standard uniquement).

> La signature est **octet-pour-octet identique** à `@cartulaire/crypto` (Node) :
> `HMAC-SHA256( secret, "timestamp.id.type.audience.body" )`.

## Installation

```bash
pip install cartulaire-connector-sdk        # une fois publié sur PyPI
# ou, en développement depuis le monorepo :
pip install -e packages/connector-sdk-python
```

## Exemple

```python
from cartulaire_connector_sdk import (
    create_connector_server, define_command, CommandFailure, ERROR_CODES,
)

def resolve(payload, ctx):
    user = my_directory.find(payload["identifier"])
    if not user:
        raise CommandFailure(ERROR_CODES["IDENTITY_NOT_FOUND"], "not found",
                             "Identifiant ou mot de passe invalide.")
    return {"sub": user.id}

server = create_connector_server(
    name="my-connector",
    audience="connector.main",
    secret=os.environ["CARTULAIRE_CONNECTOR_SECRET"],
    permissions=["identity.resolve", "admin.health"],
    commands=[
        define_command("identity.resolve", resolve),
        define_command("admin.health", lambda p, c: {"status": "ok", "connector": "my-connector"}),
    ],
)
server.run(host="0.0.0.0", port=8443)
```

## API publique (SPEC §31.2)

| Fonction | Rôle |
|---|---|
| `create_connector_server(...)` | Serveur `http.server` exposant `POST /commands` + `GET /health`. |
| `define_command(type, handler)` | Déclare une commande gérée. |
| `verify_cartulaire_signature(...)` | Vérifie signature + horodatage (bas niveau). |
| `dispatch_command(raw_body, ...)` | Cœur agnostique du framework (pour FastAPI/Flask/…). |
| `reply_success(id, result)` / `reply_error(...)` | Construisent des enveloppes de réponse. |
| `CommandFailure(code, message, safe_message)` | Erreur métier normalisée. |

Un handler reçoit `(payload: dict, ctx: CommandContext)` et renvoie un résultat
sérialisable JSON. Levez `CommandFailure` pour une erreur métier ; toute autre
exception devient `INTERNAL_ERROR` avec un `safeMessage` générique (§36).

## Utiliser un autre framework

`create_connector_server` utilise `http.server` (aucune dépendance). Pour FastAPI,
Flask, etc., réutilisez directement `dispatch_command` :

```python
from cartulaire_connector_sdk import dispatch_command
# dans votre route POST /commands :
resp = dispatch_command(raw_body, signature=sig, timestamp=ts, secret=SECRET,
                        audience=AUDIENCE, permissions=PERMS, handlers=HANDLERS)
```

## Tests

```bash
pip install -e ".[dev]"
pytest
```
