/** En-têtes HTTP du transport de commande signé (SPEC §12.1, Mode 1). */
export const CARTULAIRE_HEADERS = {
  SIGNATURE: 'x-cartulaire-signature',
  TIMESTAMP: 'x-cartulaire-timestamp',
  TRACE_ID: 'x-cartulaire-trace-id',
} as const
