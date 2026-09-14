"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  monthCostLabel: string;
};

const primaryNav = [
  { label: "Início", href: "/" },
  { label: "Fluxos", href: "/fluxos" },
  { label: "Projetos", href: "/projetos" },
  { label: "Biblioteca", href: "/biblioteca" },
  { label: "Conexões", href: "/conexoes" },
];

const futureNav = ["Copy", "Calendário", "Research"];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, monthCostLabel }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-lab-bg text-lab-text">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-lab-border bg-lab-surface-1 px-4">
        <Link href="/" className="lab-wordmark shrink-0">
          Lab<span>IA</span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="ml-6 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {primaryNav.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-control px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-lab-surface-2 text-lab-text"
                    : "text-lab-text-dim hover:bg-lab-surface-2 hover:text-lab-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {futureNav.map((label) => (
            <span
              key={label}
              aria-disabled="true"
              className="flex h-8 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-medium text-lab-text-muted opacity-70"
            >
              {label}
              <Badge className="px-1.5 py-0 text-[10px]">em breve</Badge>
            </span>
          ))}
        </nav>

        <div className="ml-4 flex shrink-0 items-center gap-3">
          <Badge variant="cost">{monthCostLabel}</Badge>
          <div
            aria-label="Usuário"
            className="flex size-9 items-center justify-center rounded-control border border-lab-border bg-lab-surface-2 text-lab-text-dim"
          >
            <CircleUserRound className="size-4" />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
