import { ERROR_CODES } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import ro from '../messages/ro.json';
import { ApiError } from './api';
import { apiErrorKey } from './error-messages';

// E-client-1 (invarianta 3.10): codurile de eroare se mapeaza pe mesaje localizate; fiecare
// namespace apiErrors are aceleasi chei in RO si EN, iar cheile sunt coduri reale.
type Tree = { [k: string]: string | Tree };

function apiErrorNamespaces(tree: Tree, path: string[] = []): { path: string[]; keys: string[] }[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    if (typeof v === 'string') return [];
    if (k === 'apiErrors') return [{ path: [...path, k], keys: Object.keys(v).sort() }];
    return apiErrorNamespaces(v, [...path, k]);
  });
}

function at(tree: Tree, path: string[]): Tree | undefined {
  return path.reduce<Tree | undefined>((node, k) => (node && typeof node[k] === 'object' ? (node[k] as Tree) : undefined), tree);
}

const CODES = new Set<string>(Object.values(ERROR_CODES));
const NON_CODE_KEYS = new Set(['GENERIC']); // Configurator.apiErrors.GENERIC

describe('apiErrorKey', () => {
  it('ApiError → cheia codului + mesajul ca fallback', () => {
    expect(apiErrorKey(new ApiError('QUOTE_EXPIRED', 409, 'x'))).toEqual({ key: 'apiErrors.QUOTE_EXPIRED', fallback: 'x' });
  });
  it('orice altceva → INTERNAL_ERROR', () => {
    expect(apiErrorKey(new Error('boom')).key).toBe('apiErrors.INTERNAL_ERROR');
    expect(apiErrorKey(undefined).key).toBe('apiErrors.INTERNAL_ERROR');
  });
});

describe('mesajele apiErrors', () => {
  const namespaces = apiErrorNamespaces(ro as unknown as Tree);

  it('exista namespace-uri apiErrors', () => {
    expect(namespaces.length).toBeGreaterThanOrEqual(12);
  });

  it.each(namespaces.map((n) => [n.path.join('.'), n] as const))('%s: aceleasi chei in RO si EN', (_name, ns) => {
    const enNode = at(en as unknown as Tree, ns.path);
    expect(enNode).toBeDefined();
    expect(Object.keys(enNode as Tree).sort()).toEqual(ns.keys);
  });

  it.each(namespaces.map((n) => [n.path.join('.'), n] as const))('%s: cheile sunt coduri din ERROR_CODES', (_name, ns) => {
    const unknown = ns.keys.filter((k) => !CODES.has(k) && !NON_CODE_KEYS.has(k));
    expect(unknown).toEqual([]);
  });

  it('Quotes acopera codurile aruncate de endpointurile de oferte', () => {
    const quotes = Object.keys(ro.Quotes.apiErrors);
    for (const code of [
      'ASSIGNED_USER_HAS_ACTIVE_CLAIM',
      'CHANGE_REQUEST_ALREADY_REJECTED',
      'CHANGE_REQUEST_NOT_PENDING',
      'CONCURRENT_MODIFICATION',
      'CONSULTATION_INVITE_EXPIRED',
      'FORBIDDEN',
      'NEGOTIATION_ENDED',
      'NOT_FOUND',
      'OFFER_FIELD_NOT_EDITABLE',
      'QUOTE_ACCEPT_NOT_ALLOWED',
      'QUOTE_ALREADY_SENT',
      'QUOTE_EXPIRED',
      'QUOTE_EXTENSION_NOT_REQUESTABLE',
      'QUOTE_NOT_MODIFIABLE',
      'QUOTE_VERSION_LIMIT_REACHED',
      'QUOTE_WITHDRAW_WINDOW_CLOSED',
      'REQUEST_NOT_OPEN_FOR_OFFERS',
      'VALIDATION_ERROR',
      'VALIDITY_EXTENSION_LIMIT_REACHED',
      'QUOTE_VERSION_CHANGED',
      'QUOTE_WITHDRAW_SLA_ACK_REQUIRED',
      'IDEMPOTENCY_CONFLICT',
      'INTERNAL_ERROR',
    ]) {
      expect(quotes).toContain(code);
    }
  });

  it('Marketplace si Lifecycle acopera validarea, eroarea interna si codurile de claim', () => {
    expect(Object.keys(ro.Marketplace.apiErrors)).toEqual(
      expect.arrayContaining([
        'VALIDATION_ERROR',
        'INTERNAL_ERROR',
        'CLAIM_NOT_ALLOWED',
        'CLAIM_SLOTS_FULL',
        'CLAIM_ALREADY_EXISTS',
        'INSUFFICIENT_CREDITS',
        'ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS',
        'ASSIGNED_USER_HAS_ACTIVE_CLAIM',
        'ASSIGNED_USER_PENALTY_BLOCKED',
      ]),
    );
    expect(Object.keys(ro.Lifecycle.apiErrors)).toEqual(
      expect.arrayContaining([
        'VALIDATION_ERROR',
        'INTERNAL_ERROR',
        'CLAIM_NOT_ALLOWED',
        'CLAIM_NOT_WITHDRAWABLE',
        'WITHDRAWAL_OUTCOME_CHANGED',
      ]),
    );
  });
});
