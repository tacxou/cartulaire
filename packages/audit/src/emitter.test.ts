import { describe, expect, it } from 'vitest'
import { AUDIT_EVENTS, createAuditEmitter, memorySink } from './index'

describe('audit emitter', () => {
  it('horodate et transmet l’événement au sink', () => {
    const { sink, events } = memorySink()
    const audit = createAuditEmitter({ sink, service: 'api' })
    audit.emit({ type: AUDIT_EVENTS.LOGIN_SUCCESS, subject: 'user_1', clientId: 'web' })

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('login.success')
    expect(events[0].subject).toBe('user_1')
    expect(typeof events[0].timestamp).toBe('string')
    expect(events[0].data).toMatchObject({ service: 'api' })
  })

  it('caviarde les secrets en profondeur (§34.1)', () => {
    const { sink, events } = memorySink()
    const audit = createAuditEmitter({ sink })
    audit.emit({
      type: AUDIT_EVENTS.LOGIN_FAILURE,
      data: { password: 'hunter2', nested: { token: 'abc', ok: 'keep' } },
    })
    expect(events[0].data).toMatchObject({
      password: '[Redacted]',
      nested: { token: '[Redacted]', ok: 'keep' },
    })
  })

  it('n’échoue jamais si le sink lève', () => {
    const audit = createAuditEmitter({
      sink: () => {
        throw new Error('sink down')
      },
    })
    expect(() => audit.emit({ type: AUDIT_EVENTS.CONNECTOR_ERROR })).not.toThrow()
  })
})
