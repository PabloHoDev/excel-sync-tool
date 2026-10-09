/**
 * Premissa usada para estimar o tempo economizado (ilustrativa e exibida na
 * interface): conferir um registro à mão — achar a linha na aba certa,
 * comparar Área e Status e corrigir se preciso — leva cerca de 20 segundos.
 */
export const MANUAL_SECONDS_PER_RECORD = 20;

export function manualMinutes(records: number) {
  return (records * MANUAL_SECONDS_PER_RECORD) / 60;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const numberFmt = new Intl.NumberFormat("pt-BR");
