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

export function AdminShellNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  const nav = <nav className="flex h-full flex-col bg-[var(--foreground)] px-5 py-6 text-[var(--accent-ink)]" aria-label="Navegacao administrativa">
    <Link href="/admin/dashboard" className="mb-10 text-xl font-semibold tracking-[-0.04em]" onClick={() => setOpen(false)}>DaBi Price</Link>
    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto">{groups.map((group) => <section key={group.label}><p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">{group.label}</p>{group.links.map(([href,label]) => { const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`mb-1 flex items-center rounded-lg px-3 py-2 text-sm transition ${active ? "bg-white/14 font-semibold text-white" : "text-white/75 hover:bg-white/8 hover:text-white"}`}>{label}</Link>; })}</section>)}</div>
    <div className="mt-6 border-t border-white/12 pt-4"><Link href="/app/precificacao" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/8">Abrir aplicativo</Link><div className="px-3 py-3 text-xs text-white/65"><p className="font-medium text-white">Conta administrativa</p><p className="mt-1">Acesso completo</p></div><button type="button" onClick={() => void logout()} className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/8 hover:text-white">Sair</button></div>
  </nav>;
  return <><button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu administrativo" className="fixed left-4 top-4 z-40 rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm text-white lg:hidden">Menu</button><aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{nav}</aside>{open ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Fechar menu administrativo" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45"/><aside className="relative h-full w-[264px]">{nav}</aside></div> : null}</>;
}
