import type { ChangeStatus } from "@/lib/engine/types";

// Status sempre com ícone + texto, nunca só cor.
const STYLES: Record<ChangeStatus, { label: string; icon: string; className: string }> = {
  OK: { label: "Atualizado", icon: "✓", className: "bg-good-soft text-good" },
  NAO_ENCONTRADO: { label: "Não encontrado", icon: "!", className: "bg-warning-soft text-warning" },
  SEM_MUDANCA: { label: "Sem mudança", icon: "=", className: "bg-surface-2 text-text-2" },
};

export function StatusBadge({ status }: { status: ChangeStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
