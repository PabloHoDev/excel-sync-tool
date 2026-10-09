import { REPO_URL } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-text-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Projeto de portfólio de{" "}
          <a href="https://github.com/PabloHoDev" className="text-text-2 underline-offset-4 hover:underline">
            Pablo Oliveira
          </a>
          . A empresa e os números da demo são fictícios.
        </p>
        <p>
          Next.js · Supabase · Vercel ·{" "}
          <a href={REPO_URL} className="text-text-2 underline-offset-4 hover:underline">
            código-fonte (MIT)
          </a>
        </p>
      </div>
    </footer>
  );
}
