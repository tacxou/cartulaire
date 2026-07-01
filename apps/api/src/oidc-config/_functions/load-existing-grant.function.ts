import { Grant, KoaContextWithOIDC } from 'oidc-provider'

/**
 * Charge le grant existant pour le client et l'utilisateur en session, ou en crée un nouveau si nécessaire.
 *
 * @see https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#loadexistinggrant
 * @param ctx Koa request context
 * @param ctx Koa request context
 * @returns Grant instance or undefined
 */
export async function loadExistingGrant(ctx: KoaContextWithOIDC): Promise<Grant | undefined> {
  const { client, params, session } = ctx.oidc
  if (!session?.accountId) return undefined

  const accountId = session.accountId
  const grantId = ctx.oidc.result?.consent?.grantId ?? session.grantIdFor(client.clientId)

  if (client?.metadata()?.['skip_consent']) {
    // Créer ou réutiliser un grant en accordant automatiquement tous les scopes demandés.
    const grant = grantId
      ? ((await ctx.oidc.provider.Grant.find(grantId)) ?? new ctx.oidc.provider.Grant({ accountId, clientId: client.clientId }))
      : new ctx.oidc.provider.Grant({ accountId, clientId: client.clientId })

    if (params?.scope) grant.addOIDCScope(params.scope as string)
    await grant.save()

    return grant
  }

  // Comportement par défaut : recharger le grant existant depuis la session.
  if (grantId) return ctx.oidc.provider.Grant.find(grantId)

  return undefined
}
