import { Injectable } from '@nestjs/common'
import { LRUCache } from 'lru-cache'
import { AbstractServiceStorage } from '~/_common/_abstracts/abstract.service.storage'

@Injectable()
export class LruAdapter extends AbstractServiceStorage {
  private readonly storage = new LRUCache<string, any>({ max: 1000 })

  public constructor() {
    super()
  }

  public async upsert(model: string, id: string, payload: Record<string, any>, expiresIn: number): Promise<void> {
    const key = this.key(model, id)
    const { grantId, userCode, uid }: any = payload

    if (model === 'Session') {
      this.storage.set(this.sessionUidKeyFor(uid), id, {
        start: expiresIn * 1000,
      })
    }

    if (this.grantable.has(model) && grantId) {
      const grantKey = this.grantKeyFor(grantId)
      const grant: string[] = this.storage.get(grantKey)

      if (!grant) {
        this.storage.set(grantKey, [key], {
          start: expiresIn * 1000,
        })
      } else {
        grant.push(key)
      }
    }

    if (userCode) {
      this.storage.set(this.userCodeKeyFor(userCode), id, {
        start: expiresIn * 1000,
      })
    }

    this.storage.set(key, payload, {
      start: expiresIn * 1000,
    })
  }

  public async delete(model: string, id: string): Promise<void> {
    const key = this.key(model, id)

    this.storage.delete(key)
  }

  public async consume(model: string, id: string): Promise<void> {
    const key = this.key(model, id)

    const data = this.storage.get(key)
    data.consumed = true
  }

  public async find(model: string, id: string): Promise<any> {
    return this.storage.get(this.key(model, id))
  }

  public async findByUid(model: string, uid: string): Promise<any> {
    const id = this.storage.get(this.sessionUidKeyFor(uid))

    return this.find(model, id)
  }

  public async findByUserCode(model: string, userCode: string): Promise<any> {
    const id = this.storage.get(this.userCodeKeyFor(userCode))

    return this.find(model, id)
  }

  public async revokeByGrantId(grantId: string): Promise<void> {
    const grantKey = this.grantKeyFor(grantId)
    const grant = this.storage.get(grantKey) as any[]

    if (grant) {
      grant.forEach((key) => this.storage.delete(key))
      this.storage.delete(grantKey)
    }
  }
}
