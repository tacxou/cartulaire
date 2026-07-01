# Connecteur MongoDB (Python + pymongo + FastAPI)

Connecteur d'exemple autonome sur MongoDB.

```bash
cd examples/connectors/mongo-python
pip install -r requirements.txt
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
MONGODB_URI="mongodb://localhost:27017/cartulaire" \
uvicorn connector:app --host 0.0.0.0 --port 8443
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`,
`consent.get`, `consent.save`, `admin.health`.
