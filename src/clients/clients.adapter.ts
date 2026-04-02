import { Adapter, AdapterPayload } from 'oidc-provider'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'
import { StorageService } from '~/storage/storage.service'
import { ClientsService } from './clients.service'

/**
 * Adaptateur pour le modèle `Client` d'oidc-provider.
 *
 * La résolution d'un client suit la priorité suivante :
 *  1. Liste en mémoire issue du YAML (rechargée à chaud par chokidar via ClientsService)
 *  2. Base de données — méthode à implémenter (`findFromDatabase`)
 *  3. `Promise.resolve()` → valeur falsy → client inconnu, accès refusé
 *
 * Toutes les autres opérations (upsert, consume, destroy…) sont déléguées
 * au StorageService sous-jacent afin de préserver le comportement standard.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#clients
 */
export class ClientsAdapter implements Adapter {
  private readonly base: StorageService

  public constructor(
    private readonly clientsService: ClientsService,
    dbService: AbstractServiceStorage,
  ) {
    this.base = new StorageService('Client', dbService)
  }

  public async find(id: string): Promise<void | AdapterPayload> {
    const fromYaml = this.clientsService
      .getClients()
      .find((c) => c.client_id === id)

    if (fromYaml) return fromYaml as AdapterPayload

    const fromDb = await this.findFromDatabase(id)
    if (fromDb) return fromDb

    return Promise.resolve()
  }

  /**
   * Recherche un client dans la base de données.
   * @todo Implémenter la logique de récupération depuis la base de données.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async findFromDatabase(_id: string): Promise<AdapterPayload | undefined> {
    return undefined
  }

  public async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    return this.base.upsert(id, payload, expiresIn)
  }

  public async findByUserCode(userCode: string): Promise<void | AdapterPayload> {
    return this.base.findByUserCode(userCode)
  }

  public async findByUid(uid: string): Promise<void | AdapterPayload> {
    return this.base.findByUid(uid)
  }

  public async consume(id: string): Promise<void> {
    return this.base.consume(id)
  }

  public async destroy(id: string): Promise<void> {
    return this.base.destroy(id)
  }

  public async revokeByGrantId(grantId: string): Promise<void> {
    return this.base.revokeByGrantId(grantId)
  }
}
