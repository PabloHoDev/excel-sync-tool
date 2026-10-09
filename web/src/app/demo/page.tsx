import type { Metadata } from "next";
import { DemoClient } from "@/components/demo/demo-client";

export const metadata: Metadata = {
  title: "Demo",
  description: "Rode a sincronização num cenário fictício ou com as suas próprias planilhas.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Demonstração</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        Simule um dia de operação da Nimbus Serviços (empresa fictícia) ou envie as suas planilhas. O resultado mostra
        cada célula alterada, e você pode baixar a planilha atualizada e o log.
      </p>
      <DemoClient />
    </div>
  );
}
