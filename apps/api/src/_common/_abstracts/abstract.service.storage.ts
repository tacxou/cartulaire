import { Injectable } from '@nestjs/common'
import { AbstractService } from './abstract.service'

@Injectable()
export abstract class AbstractServiceStorage extends AbstractService {
  protected readonly grantable = new Set([
    'AccessToken',
    'AuthorizationCode',
    'RefreshToken',
    'DeviceCode',
    'BackchannelAuthenticationRequest',
  ])

  protected readonly consumable = new Set([
    'AuthorizationCode',
    'RefreshToken',
    'DeviceCode',
    'BackchannelAuthenticationRequest',
  ])

  protected key(model: string, id: string): string {
    return `${model}:${id}`
  }

  protected grantKeyFor(id: string): string {
    return `grant:${id}`
  }

  protected sessionUidKeyFor(id: string): string {
    return `sessionUid:${id}`
  }

  protected userCodeKeyFor(userCode: string): string {
    return `userCode:${userCode}`
  }

  /**
   * Upsert a new user session in the storage
   *
   * @param model string
   * @param id string
   * @param payload Record<string, any>
   * @param expiresIn number
   */
  public abstract upsert(model: string, id: string, payload: Record<string, any>, expiresIn: number): Promise<void>

  /**
   * Delete a user session from the storage
   *
   * @param model string
   * @param id string
   */
  public abstract delete(model: string, id: string): Promise<void>

  /**
   * Consume a user session from the storage
   *
   * @param model string
   * @param id string
   */
  public abstract consume(model: string, id: string): Promise<void>

  /**
   * Find a user session from the storage
   *
   * @param model string
   * @param id string
   */
  public abstract find(model: string, id: string): Promise<any>

  /**
   * Find a user session by UID from the storage
   *
   * @param model string
   * @param uid string
   */
  public abstract findByUid(model: string, uid: string): Promise<any>

  /**
   * Find a user session by user code from the storage
   *
   * @param model string
   * @param userCode string
   */
  public abstract findByUserCode(model: string, userCode: string): Promise<any>

  /**
   * Revoke a user session by grant ID from the storage
   *
   * @param grantId string
   */
  public abstract revokeByGrantId(grantId: string): Promise<void>
}
