# Connecteur SQL (Python + SQLAlchemy + FastAPI)

Connecteur d'exemple autonome sur base SQL via **SQLAlchemy Core** (PostgreSQL par défaut).

```bash
cd examples/connectors/sql-python
pip install -r requirements.txt
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
DATABASE_URL="postgresql+psycopg://cartulaire:pass@localhost:5432/cartulaire" \
uvicorn connector:app --host 0.0.0.0 --port 8443
```

## Schéma minimal

```sql
CREATE TABLE users (id text PRIMARY KEY, username text, email text, password_hash text);
CREATE TABLE consents (subject text, client_id text, scopes text,
                       PRIMARY KEY (subject, client_id));
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`,
`consent.get`, `consent.save`, `admin.health`.

> Pour du très haut débit PostgreSQL, remplacez SQLAlchemy Core par `asyncpg` (§30).
