import "server-only";

/**
 * Limite simples por IP, em memória. Em ambiente serverless cada instância tem
 * a sua contagem, então isto é uma proteção de melhor esforço contra abuso da
 * demo pública, não um controle forte (para isso: Vercel Firewall / Upstash).
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_REQUESTS;
}
