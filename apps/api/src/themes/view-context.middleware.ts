import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { ThemesService } from './themes.service'

@Injectable()
export class ViewContextMiddleware implements NestMiddleware {
  public constructor(private readonly themes: ThemesService) {}

  public use(_req: Request, res: Response, next: NextFunction): void {
    this.patchRender(res)
    next()
  }

  private patchRender(res: Response): void {
    const resWithFlag = res as Response & { _themeRenderPatched?: boolean }
    if (resWithFlag._themeRenderPatched) return

    const originalRender = res.render.bind(res)

    res.render = (view: string, options?: object, callback?: (...args: unknown[]) => void) => {
      const pageKey = this.themes.resolveTemplatePageKey(view)
      const locals = this.themes.getViewLocals(pageKey)
      const merged = { ...locals, ...(options ?? {}) }
      return originalRender(view, merged, callback)
    }

    resWithFlag._themeRenderPatched = true
  }
}
