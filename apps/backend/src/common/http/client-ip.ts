import { BlockList, isIP } from 'net';
import type { NextFunction, Request, Response } from 'express';

// E-admin-platform-5 (SEC2-3 / SEC1-21): un singur rezolvator pentru IP-ul clientului,
// folosit de throttler, audit si health. In productie lantul e
// client -> edge Railway -> Caddy -> Next (:3000) -> rewrite loopback -> Nest (:3001),
// iar req.ip (trust proxy 'loopback') ajunge adresa edge-ului/proxy-ului, nu a clientului.
// Headerul de la edge (ex. x-real-ip) e crezut DOAR daca e configurat explicit
// (TRUSTED_CLIENT_IP_HEADER, dupa testul de spoofing) SI peer-ul socketului e loopback
// (adica cererea a venit prin rewrite-ul Next din acelasi container).

export type ClientIpScope = 'loopback' | 'private' | 'public' | 'unknown';
export type ClientIpSource = 'header' | 'socket';

type ClientIpRequest = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  clientIp?: string | null;
  clientIpSource?: ClientIpSource;
};

export function normalizeIp(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  let ip = raw.trim();
  if (/^::ffff:/i.test(ip) && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip.toLowerCase() : null;
}

const loopback = new BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

const privateRanges = new BlockList();
privateRanges.addSubnet('10.0.0.0', 8, 'ipv4');
privateRanges.addSubnet('172.16.0.0', 12, 'ipv4');
privateRanges.addSubnet('192.168.0.0', 16, 'ipv4');
// CGNAT: adresele tipice ale proxy-urilor/edge-urilor managed
privateRanges.addSubnet('100.64.0.0', 10, 'ipv4');
privateRanges.addSubnet('169.254.0.0', 16, 'ipv4');
privateRanges.addSubnet('fc00::', 7, 'ipv6');
privateRanges.addSubnet('fe80::', 10, 'ipv6');

function family(ip: string): 'ipv4' | 'ipv6' {
  return isIP(ip) === 4 ? 'ipv4' : 'ipv6';
}

function isLoopback(ip: string | null): boolean {
  return ip !== null && loopback.check(ip, family(ip));
}

export function ipScope(ip?: string | null): ClientIpScope {
  const normalized = normalizeIp(ip);
  if (!normalized) return 'unknown';
  if (isLoopback(normalized)) return 'loopback';
  if (privateRanges.check(normalized, family(normalized))) return 'private';
  return 'public';
}

function headerValue(req: ClientIpRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function resolveClientIp(
  req: ClientIpRequest,
  trustedHeader?: string,
): { ip: string | null; source: ClientIpSource } {
  if (trustedHeader && isLoopback(normalizeIp(req.socket?.remoteAddress))) {
    const first = headerValue(req, trustedHeader.toLowerCase())?.split(',')[0];
    const fromHeader = normalizeIp(first);
    if (fromHeader) return { ip: fromHeader, source: 'header' };
  }
  return { ip: normalizeIp(req.ip), source: 'socket' };
}

// Middleware express: rezolva IP-ul o singura data per request.
export function clientIpMiddleware(trustedHeader?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const target = req as unknown as ClientIpRequest;
    const { ip, source } = resolveClientIp(target, trustedHeader);
    target.clientIp = ip;
    target.clientIpSource = source;
    next();
  };
}

export function clientIpOf(req: { ip?: string; clientIp?: string | null }): string | null {
  return req.clientIp ?? normalizeIp(req.ip);
}

export function clientIpSourceOf(req: { clientIpSource?: ClientIpSource }): ClientIpSource {
  return req.clientIpSource ?? 'socket';
}

// Expandeaza o adresa IPv6 in 8 grupe hex (suporta '::' si IPv4 incorporat la final).
function expandIpv6(ip: string): string[] {
  let address = ip;
  const dotted = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    address =
      address.slice(0, -dotted[1].length) +
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill = tail !== undefined ? Array<string>(8 - left.length - right.length).fill('0') : [];
  return [...left, ...fill, ...right].map((group) => group.padStart(4, '0'));
}

// Cheia de throttling: IPv4 ca atare; IPv6 pe prefixul /64 (clientul isi poate roti
// adresele in /64-ul primit de la ISP, deci o adresa = un bucket ar fi ocolibil).
export function throttleBucket(ip?: string | null): string {
  const normalized = normalizeIp(ip);
  if (!normalized) return 'unknown';
  if (isIP(normalized) === 4) return normalized;
  return `v6:${expandIpv6(normalized).slice(0, 4).join(':')}::/64`;
}
