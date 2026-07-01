import { Adapter, AdapterPayload } from 'oidc-provider'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'

export class StorageService implements Adapter {
  public constructor(
    public modelName: string,
    public dbService: AbstractServiceStorage,
  ) {}

  public async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    await this.dbService.upsert(this.modelName, id, payload, expiresIn)
  }

  public async find(id: string): Promise<void | AdapterPayload> {
    return (await this.dbService.find(this.modelName, id)) as AdapterPayload
  }

  public async findByUserCode(userCode: string): Promise<void | AdapterPayload> {
    return (await this.dbService.findByUserCode(this.modelName, userCode)) as AdapterPayload
  }

  public async findByUid(uid: string): Promise<void | AdapterPayload> {
    return (await this.dbService.findByUid(this.modelName, uid)) as AdapterPayload
  }

  public async consume(id: string): Promise<void> {
    await this.dbService.consume(this.modelName, id)
  }

  public async destroy(id: string): Promise<void> {
    await this.dbService.delete(this.modelName, id)
  }

  public async revokeByGrantId(grantId: string): Promise<void> {
    await this.dbService.revokeByGrantId(grantId)
  }
}
