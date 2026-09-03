"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const groups = [
  { label: "Administracao", links: [["/admin/dashboard", "Dashboard"]] },
  { label: "Comercial", links: [["/admin/assinaturas", "Assinaturas"], ["/admin/pagamentos", "Pagamentos"]] },
  { label: "Clientes", links: [["/admin/usuarios", "Usuarios"], ["/admin/workspaces", "Workspaces"]] },
  { label: "Operacao", links: [["/admin/eventos", "Eventos"], ["/admin/sistema", "Sistema"]] },
] as const;

export function AdminShellNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("dabi-price-theme") === "dark"
        ? "dark"
        : "light";
    }

    return "light";
  });
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("dabi-price-theme", nextTheme);
  }
  const nav = <nav className="flex h-full flex-col bg-[var(--admin-shell-nav-bg)] px-5 py-6 text-[var(--admin-shell-nav-fg)]" aria-label="Navegacao administrativa">
    <Link href="/admin/dashboard" className="mb-10 text-2xl font-semibold tracking-[-0.04em]" onClick={() => setOpen(false)}>DaBi Price</Link>
    <div className="min-h-0 flex-1 space-y-8 overflow-y-auto">{groups.map((group) => <section key={group.label}><p className="mb-3 px-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--admin-shell-nav-muted)]">{group.label}</p>{group.links.map(([href,label]) => { const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`mb-1 flex items-center rounded-lg px-3 py-2.5 text-base transition ${active ? "bg-[var(--admin-shell-nav-active)] font-semibold text-[var(--admin-shell-nav-fg)]" : "text-[var(--admin-shell-nav-muted)] hover:bg-[var(--admin-shell-nav-active)] hover:text-[var(--admin-shell-nav-fg)]"}`}>{label}</Link>; })}</section>)}</div>
    <div className="mt-6 border-t border-white/20 pt-5"><button type="button" onClick={toggleTheme} aria-label="Alternar tema" aria-pressed={theme === "dark"} className="w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-[var(--admin-shell-nav-fg)] hover:bg-[var(--admin-shell-nav-active)]">{theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}</button><Link href="/app/precificacao" className="block rounded-lg px-3 py-2.5 text-base font-medium text-[var(--admin-shell-nav-fg)] hover:bg-[var(--admin-shell-nav-active)]">Abrir aplicativo</Link><div className="px-3 py-4 text-sm text-[var(--admin-shell-nav-muted)]"><p className="font-semibold text-[var(--admin-shell-nav-fg)]">{userName}</p><p className="mt-1 text-[var(--admin-shell-nav-fg)]">Conta administrativa</p><p>Acesso completo</p></div><button type="button" onClick={() => void logout()} className="w-full rounded-lg px-3 py-2.5 text-left text-base text-[var(--admin-shell-nav-muted)] hover:bg-[var(--admin-shell-nav-active)] hover:text-[var(--admin-shell-nav-fg)]">Sair</button></div>
  </nav>;
  return <><button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu administrativo" className="fixed left-4 top-4 z-40 rounded-lg bg-[var(--admin-shell-nav-bg)] px-3 py-2 text-sm text-[var(--admin-shell-nav-fg)] lg:hidden">Menu</button><aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{nav}</aside>{open ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Fechar menu administrativo" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45"/><aside className="relative h-full w-[264px]">{nav}</aside></div> : null}</>;
}
