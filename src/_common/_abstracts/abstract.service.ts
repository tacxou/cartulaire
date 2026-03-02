import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { RequestContextStorage } from '@tacxou/nestjs_module_restools'
import { Request } from 'express'

export interface AbstractServiceContext {
  [key: string | number]: any

  moduleRef?: ModuleRef
  req?: Request & { user?: Express.User }
  serviceName?: string
}

@Injectable()
export abstract class AbstractService {
  protected logger: Logger
  protected moduleRef: ModuleRef
  private readonly _req?: Request & { user?: Express.User & any }

  private _customServiceName: string

  protected constructor(context?: AbstractServiceContext) {
    this.moduleRef = context?.moduleRef
    this._req = context?.req
    this.logger = new Logger(this.serviceName)

    this._customServiceName = context?.serviceName
  }

  protected get request():
    | (Request & {
        user?: Express.User & any
      })
    | null {
    return this._req || RequestContextStorage.currentContext?.req
  }

  public get serviceName(): string {
    if (!this.constructor.name && !this._customServiceName) throw new Error('Service name is not defined in ' + this.constructor.name)
    return this._customServiceName || this.constructor.name.replace(/Service$/, '')
  }
}
