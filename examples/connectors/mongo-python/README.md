# Connecteur MongoDB (Python + pymongo + FastAPI)

Connecteur d'exemple sur MongoDB, utilisant le SDK officiel **`cartulaire-connector-sdk`**.

```bash
cd examples/connectors/mongo-python
pip install -r requirements.txt
# dev local : pip install -e ../../../packages/connector-sdk-python
CARTULAIRE_CONNECTOR_SECRET="<secret partagé>" \
MONGODB_URI="mongodb://localhost:27017/cartulaire" \
CARTULAIRE_CONNECTOR_PORT=8443 \
python connector.py
```

## Commandes

`identity.resolve`, `auth.verifyPassword` (bcrypt), `claims.map`,
`consent.get`, `consent.save`, `admin.health`.
