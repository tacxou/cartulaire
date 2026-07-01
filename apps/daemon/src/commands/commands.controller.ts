import { Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { CARTULAIRE_HEADERS } from '@cartulaire/core'
import { CommandsService } from './commands.service'

/**
 * Point d'entrée unique du daemon (SPEC §13). `POST /commands` reçoit une
 * commande signée ; le corps brut exact est requis pour vérifier la signature,
 * d'où l'usage de `req.rawBody` (activé via `rawBody: true` au bootstrap).
 */
@Controller()
export class CommandsController {
  constructor(private readonly commands: CommandsService) {}

  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'daemon' }
  }

  @Post('commands')
  async handle(@Req() req: Request & { rawBody?: Buffer }) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {})
    const signature = headerValue(req.headers[CARTULAIRE_HEADERS.SIGNATURE])
    const timestamp = headerValue(req.headers[CARTULAIRE_HEADERS.TIMESTAMP])
    return this.commands.route(rawBody, signature, timestamp)
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
