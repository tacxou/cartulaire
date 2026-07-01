import { Injectable } from '@nestjs/common'
import {
  AUDIT_EVENTS,
  createAuditEmitter,
  stdoutJsonSink,
  type AuditEmitter,
  type AuditEventInput,
} from '@cartulaire/audit'

/**
 * Service d'audit du cœur (SPEC §35). Émet des événements de sécurité dédiés,
 * distincts des logs applicatifs, sur un sink configurable (stdout JSON par
 * défaut ; en V1 : microservice `audit.emit` / SIEM). Ne contient jamais de secret.
 */
@Injectable()
export class AuditService {
  private readonly emitter: AuditEmitter = createAuditEmitter({ sink: stdoutJsonSink, service: 'api' })

  /** Émet un événement d'audit brut. */
  emit(event: AuditEventInput): void {
    this.emitter.emit(event)
  }

  loginSuccess(subject: string, clientId?: string, traceId?: string): void {
    this.emit({ type: AUDIT_EVENTS.LOGIN_SUCCESS, subject, clientId, traceId, protocol: 'oidc' })
  }

  loginFailure(reason: string, clientId?: string, traceId?: string): void {
    // On n'inscrit jamais l'identifiant tenté ni le mot de passe (§36.1).
    this.emit({ type: AUDIT_EVENTS.LOGIN_FAILURE, reason, clientId, traceId, protocol: 'oidc' })
  }

  consentAccepted(subject: string, clientId: string, scopes: string[]): void {
    this.emit({
      type: AUDIT_EVENTS.OAUTH_CONSENT_ACCEPTED,
      subject,
      clientId,
      protocol: 'oidc',
      data: { scopes },
    })
  }

  sessionRevoked(subject: string, sid?: string): void {
    this.emit({ type: AUDIT_EVENTS.SESSION_REVOKED, subject, data: sid ? { sid } : undefined })
  }

  connectorError(command: string, code: string, traceId?: string): void {
    this.emit({ type: AUDIT_EVENTS.CONNECTOR_ERROR, reason: code, traceId, data: { command } })
  }
}
