import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Painel",
  description: "Histórico das execuções de sincronização: volume conferido, células atualizadas e tempo economizado.",
};

export default function PainelPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Painel de execuções</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        Cada sincronização fica registrada no Supabase: o que foi conferido, o que mudou e quanto tempo de trabalho
        manual isso representa.
      </p>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy className="mt-8 space-y-6" aria-label="Carregando painel">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
    </div>
  );
}
