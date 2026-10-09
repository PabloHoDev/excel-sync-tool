import Link from "next/link";

export const REPO_URL = "https://github.com/PabloHoDev/excel-sync-tool";

const NAV = [
  { href: "/demo", label: "Demo" },
  { href: "/painel", label: "Painel" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent">
            ⇄
          </span>
          excel-sync-tool
        </Link>
        <nav className="flex items-center text-sm sm:gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-2 py-1.5 whitespace-nowrap text-text-2 sm:px-3 hover:bg-surface-2 hover:text-text">
              {item.label}
            </Link>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2 py-1.5 whitespace-nowrap text-text-2 sm:px-3 hover:bg-surface-2 hover:text-text"
          >
            GitHub<span aria-hidden className="hidden sm:inline"> ↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
