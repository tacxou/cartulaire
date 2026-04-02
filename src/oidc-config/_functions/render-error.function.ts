import { ErrorOut, errors, KoaContextWithOIDC } from 'oidc-provider'

/**
 * Render the error page
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#rendererror
 * @param ctx Koa request context
 * @param _out Output object
 * @param error Error object
 * @param render Nunjucks render function
 */
export async function renderError(
  ctx: KoaContextWithOIDC,
  _out: ErrorOut,
  error: errors.OIDCProviderError | Error,
  render: (template: string, data: any) => string,
): Promise<void> {
  ctx.type = 'html'
  ctx.body = render('pages/error.njk', { error })
}
