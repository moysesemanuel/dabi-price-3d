"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { DabiMark, DabiWordmark } from "@/components/brand/dabi-brand";
import type { PlatformRole } from "@/lib/server/platform";
import {
  type BusinessType,
  defaultAppPreferences,
  getWorkspacePlan,
  loadAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
} from "@/lib/settings/app-preferences";
import {
  canAccessAppPathWithoutPaidWorkspace,
} from "@/lib/workspace/subscription-access";
import type { WorkspacePlanId } from "@/lib/workspace/catalog";

const EXPANDED_WIDTH = 262;
const COLLAPSED_WIDTH = 96;
const THEME_STORAGE_KEY = "dabi-price-theme";

type ThemeMode = "light" | "dark";
type SidebarIconProps = SVGProps<SVGSVGElement>;
type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<SidebarIconProps>;
  superAdminOnly?: boolean;
};
type NavigationGroup = {
  type: "group";
  id: string;
  label: string;
  icon: ComponentType<SidebarIconProps>;
  items: NavigationItem[];
};
type NavigationEntry = NavigationItem | NavigationGroup;
type NavigationSection = {
  id: string;
  label?: string;
  items: NavigationEntry[];
};

type SidebarVariant = "default" | "confectionery";

function isNavigationGroup(entry: NavigationEntry): entry is NavigationGroup {
  return "type" in entry && entry.type === "group";
}

function HouseDoorFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 8h.5v6A1.5 1.5 0 0 0 4 15.5h2A1.5 1.5 0 0 0 7.5 14v-2.5h1V14A1.5 1.5 0 0 0 10 15.5h2a1.5 1.5 0 0 0 1.5-1.5V8h.5a.5.5 0 0 0 .354-.854z" />
    </svg>
  );
}

function CalculatorFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .5v2a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5m0 4v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 12.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 6a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM7 9.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM10 6.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
    </svg>
  );
}

function FileEarmarkTextIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5.5 7a.5.5 0 0 0 0 1H10a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5H10a.5.5 0 0 1 0 1H5.5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5H8a.5.5 0 0 1 0 1H5.5a.5.5 0 0 1-.5-.5" />
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z" />
    </svg>
  );
}

function SlidersIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"
      />
    </svg>
  );
}

function BuildingIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M6.5 15V1h3v14zm-1 0V7h-4v8zm5 0h4V4h-4zM4 2a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1V3H15a1 1 0 0 1 1 1v11h-1V4h-2.5v11h-9V8H1V7h2.5V2zM8 3.5A.5.5 0 0 0 7.5 4v1A.5.5 0 0 0 8 5.5h1a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5zm0 3A.5.5 0 0 0 7.5 7v1A.5.5 0 0 0 8 8.5h1a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5z" />
    </svg>
  );
}

function QuestionCircleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94" />
    </svg>
  );
}

function HeadsetIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 1a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a6 6 0 1 1 12 0v6a2.5 2.5 0 0 1-2.5 2.5H9.366a1 1 0 0 1-.866.5h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 .866.5H11.5A1.5 1.5 0 0 0 13 12h-1a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1V6a5 5 0 0 0-5-5" />
    </svg>
  );
}

function PersonCircleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      <path
        fillRule="evenodd"
        d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"
      />
    </svg>
  );
}

function PeopleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
    </svg>
  );
}

function CalendarWeekIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14 2h-1V1a.5.5 0 0 0-1 0v1H4V1a.5.5 0 0 0-1 0v1H2a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M1 5h14v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm4 2.5A.5.5 0 0 1 5.5 7h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 5 7.5m2.5 0A.5.5 0 0 1 8 7h1a.5.5 0 0 1 0 1H8a.5.5 0 0 1-.5-.5M10 7.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5M5 10.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m2.5 0A.5.5 0 0 1 8 10h1a.5.5 0 0 1 0 1H8a.5.5 0 0 1-.5-.5" />
    </svg>
  );
}

function BasketIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2.31 5.243A1 1 0 0 0 1.33 6.5l.67 6A1.5 1.5 0 0 0 3.49 14h9.02A1.5 1.5 0 0 0 14 12.5l.67-6a1 1 0 0 0-.98-1.257H11.1l-2.3-3.066a.5.5 0 1 0-.8.6l1.85 2.466H6.15L8 2.777a.5.5 0 0 0-.8-.6L4.9 5.243zm1.72 2.257a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V8a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V8a.5.5 0 0 1 .5-.5m4 .5a.5.5 0 0 0-1 0v3a.5.5 0 0 0 1 0z" />
    </svg>
  );
}

function FolderIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9.828 4a3 3 0 0 1 2.122.879l.414.414A2 2 0 0 0 13.778 6H14a2 2 0 0 1 2 2v4.5A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5v-7A1.5 1.5 0 0 1 1.5 4zM1.5 5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V8a1 1 0 0 0-1-1h-.222a3 3 0 0 1-2.121-.879l-.415-.414A2 2 0 0 0 9.828 5z" />
    </svg>
  );
}

function GridFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v3A1.5 1.5 0 0 0 2.5 7h3A1.5 1.5 0 0 0 7 5.5v-3A1.5 1.5 0 0 0 5.5 1zm0 8A1.5 1.5 0 0 0 1 10.5v3A1.5 1.5 0 0 0 2.5 15h3A1.5 1.5 0 0 0 7 13.5v-3A1.5 1.5 0 0 0 5.5 9zm8-8A1.5 1.5 0 0 0 9 2.5v3A1.5 1.5 0 0 0 10.5 7h3A1.5 1.5 0 0 0 15 5.5v-3A1.5 1.5 0 0 0 13.5 1zm0 8A1.5 1.5 0 0 0 9 10.5v3a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 13.5 9z" />
    </svg>
  );
}

function BoxSeamIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.186.113a1 1 0 0 0-.372 0l-6 1.5A1 1 0 0 0 1 2.583v8.834a1 1 0 0 0 .758.97l6 1.5a1 1 0 0 0 .484 0l6-1.5a1 1 0 0 0 .758-.97V2.583a1 1 0 0 0-.814-.97zM8 1.152l5.49 1.373L8 3.898 2.51 2.525zM2 3.694l5.5 1.375v7.779L2 11.472zm6.5 9.154V5.069L14 3.694v7.778z" />
    </svg>
  );
}

function WalletIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M0 3a2 2 0 0 1 2-2h10a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm13 1V2H2a1 1 0 0 0 0 2zm1 1H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1zm-3.5 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2" />
    </svg>
  );
}

function GearFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9.405 1.05a1 1 0 0 0-.81 0l-.982.39a1 1 0 0 1-.814 0l-.982-.39a1 1 0 0 0-1.223.45l-.49.848a1 1 0 0 1-.703.5l-.96.174a1 1 0 0 0-.8 1.02l.06.978a1 1 0 0 1-.244.718l-.637.744a1 1 0 0 0 0 1.304l.637.744a1 1 0 0 1 .244.718l-.06.978a1 1 0 0 0 .8 1.02l.96.174a1 1 0 0 1 .704.5l.49.848a1 1 0 0 0 1.222.45l.982-.39a1 1 0 0 1 .814 0l.982.39a1 1 0 0 0 1.223-.45l.49-.848a1 1 0 0 1 .703-.5l.96-.174a1 1 0 0 0 .8-1.02l-.06-.978a1 1 0 0 1 .244-.718l.637-.744a1 1 0 0 0 0-1.304l-.637-.744a1 1 0 0 1-.244-.718l.06-.978a1 1 0 0 0-.8-1.02l-.96-.174a1 1 0 0 1-.704-.5l-.49-.848a1 1 0 0 0-1.222-.45zM8 10.5A2.5 2.5 0 1 1 8 5a2.5 2.5 0 0 1 0 5.5" />
    </svg>
  );
}

function ListCheckIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2.5 12.5a.5.5 0 0 1-.354-.854l1-1a.5.5 0 0 1 .708.708l-.646.646.646.646a.5.5 0 0 1-.708.708zm0-4a.5.5 0 0 1-.354-.854l1-1a.5.5 0 0 1 .708.708l-.646.646.646.646a.5.5 0 0 1-.708.708zm0-4a.5.5 0 0 1-.354-.854l1-1a.5.5 0 1 1 .708.708L3.207 4l.647.646a.5.5 0 0 1-.708.708zM6 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 6 4m0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 6 8m.5 3.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z" />
    </svg>
  );
}

function Link45degIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4.715 6.542a3 3 0 0 1 0-4.243l1.414-1.414a3 3 0 0 1 4.243 4.243L9.664 5.836a.5.5 0 0 1-.707-.707l.707-.707a2 2 0 1 0-2.829-2.829L5.421 2.3a2 2 0 0 0 0 2.829.5.5 0 0 1-.706.707m6.57 2.916a3 3 0 0 1 0 4.243l-1.414 1.414a3 3 0 0 1-4.243-4.243l.707-.707a.5.5 0 0 1 .707.707l-.707.707a2 2 0 1 0 2.829 2.829l1.414-1.414a2 2 0 0 0 0-2.829.5.5 0 0 1 .707-.707M5.854 10.146a.5.5 0 0 1 0-.707l4.292-4.293a.5.5 0 1 1 .708.708L6.56 10.146a.5.5 0 0 1-.707 0" />
    </svg>
  );
}

const navigationSections: NavigationSection[] = [
  {
    id: "workspace",
    label: "Operação",
    items: [
      { href: "/app", label: "Início", icon: HouseDoorFillIcon },
      {
        href: "/app/precificacao",
        label: "Precificadora",
        icon: CalculatorFillIcon,
      },
      {
        href: "/app/orcamentos",
        label: "Orçamentos",
        icon: FileEarmarkTextIcon,
      },
      {
        href: "/app/modelos-orcamento",
        label: "Modelos de orçamento",
        icon: SlidersIcon,
      },
    ],
  },
  {
    id: "company",
    label: "Empresa",
    items: [
      {
        href: "/app/perfil-empresa",
        label: "Perfil da empresa",
        icon: BuildingIcon,
      },
      { href: "/app/equipe", label: "Equipe", icon: PeopleIcon },
      {
        href: "/app/preferencias",
        label: "Preferências",
        icon: SlidersIcon,
      },
    ],
  },
  {
    id: "support",
    label: "Ajuda",
    items: [
      { href: "/app/ajuda", label: "Ajuda", icon: QuestionCircleIcon },
      { href: "/app/suporte", label: "Suporte", icon: HeadsetIcon },
      { href: "/app/conta", label: "Conta", icon: PersonCircleIcon },
      { href: "/app/assinatura", label: "Assinatura", icon: WalletIcon },
      {
        href: "/admin/dashboard",
        label: "Admin",
        icon: PeopleIcon,
        superAdminOnly: true,
      },
    ],
  },
];

const confectioneryNavigationSections: NavigationSection[] = [
  {
    id: "main",
    items: [
      { href: "/app", label: "Início", icon: HouseDoorFillIcon },
      {
        href: "/app/agenda",
        label: "Agenda",
        icon: CalendarWeekIcon,
      },
      {
        href: "/app/vendas",
        label: "Vendas",
        icon: BasketIcon,
      },
      {
        type: "group",
        id: "calculadora",
        label: "Calculadora",
        icon: CalculatorFillIcon,
        items: [
          {
            href: "/app/precificacao",
            label: "Abrir calculadora",
            icon: CalculatorFillIcon,
          },
          {
            href: "/app/orcamentos",
            label: "Histórico",
            icon: FileEarmarkTextIcon,
          },
        ],
      },
      {
        type: "group",
        id: "cadastros",
        label: "Cadastros",
        icon: FolderIcon,
        items: [
          { href: "/app/clientes", label: "Clientes", icon: PeopleIcon },
          { href: "/app/categorias", label: "Categorias", icon: GridFillIcon },
          { href: "/app/produtos", label: "Produtos", icon: BoxSeamIcon },
          {
            href: "/app/receitas",
            label: "Receitas",
            icon: FileEarmarkTextIcon,
          },
          { href: "/app/insumos", label: "Insumos", icon: BoxSeamIcon },
          {
            href: "/app/formas-pagamento",
            label: "Formas de pagamento",
            icon: WalletIcon,
          },
        ],
      },
      {
        type: "group",
        id: "gestao",
        label: "Gestão",
        icon: GearFillIcon,
        items: [
          { href: "/app/producao", label: "Produção", icon: GearFillIcon },
          { href: "/app/estoque", label: "Estoque", icon: BoxSeamIcon },
          { href: "/app/financeiro", label: "Financeiro", icon: WalletIcon },
          {
            href: "/app/lista-compras",
            label: "Lista de compras",
            icon: ListCheckIcon,
          },
        ],
      },
      {
        href: "/app/integracoes",
        label: "Integrações",
        icon: Link45degIcon,
      },
      {
        href: "/app/perfil-empresa",
        label: "Meu Perfil",
        icon: PersonCircleIcon,
      },
      {
        href: "/app/assinatura",
        label: "Assinatura",
        icon: WalletIcon,
      },
    ],
  },
  {
    id: "admin",
    items: [
      {
        href: "/admin/dashboard",
        label: "Admin",
        icon: PeopleIcon,
        superAdminOnly: true,
      },
    ],
  },
];

export function AppSidebar({
  platformRole,
  initialBusinessType = null,
  canUsePaidFeatures,
  initialPlanId,
  isSuperAdmin,
}: {
  platformRole: PlatformRole;
  initialBusinessType?: BusinessType | null;
  canUsePaidFeatures: boolean;
  initialPlanId: WorkspacePlanId;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(
    defaultAppPreferences.workspaceName,
  );
  const [operatorLabel, setOperatorLabel] = useState("Configuração pendente");
  const [businessType, setBusinessType] = useState<BusinessType | null>(
    initialBusinessType,
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    calculadora: true,
    cadastros: true,
    gestao: true,
  });
  const plan = getWorkspacePlan(initialPlanId);
  const planLabel = isSuperAdmin ? "Conta administrativa" : plan.label;
  const planPriceLabel = isSuperAdmin ? "Acesso completo à plataforma" : plan.monthlyPriceLabel;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
        ? "dark"
        : "light";
    }

    return "light";
  });

  const sidebarVariant: SidebarVariant =
    businessType === "confectionery" ? "confectionery" : "default";
  const activeNavigationSections =
    sidebarVariant === "confectionery"
      ? confectioneryNavigationSections
      : navigationSections;
  const visibleSections = activeNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.reduce<NavigationEntry[]>((entries, entry) => {
        if (isNavigationGroup(entry)) {
          const items = entry.items.filter(
            (item) => !item.superAdminOnly || platformRole === "super_admin",
          );

          if (items.length > 0) {
            entries.push({ ...entry, items });
          }

          return entries;
        }

        if (!entry.superAdminOnly || platformRole === "super_admin") {
          if (
            !canUsePaidFeatures &&
            !entry.href.startsWith("/admin/") &&
            !canAccessAppPathWithoutPaidWorkspace(entry.href)
          ) {
            return entries;
          }

          entries.push(entry);
        }

        return entries;
      }, []),
    }))
    .filter((section) => section.items.length > 0);

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
    );
  }, [isExpanded]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>(".app-shell");

    if (appShell) {
      appShell.dataset.businessType = businessType ?? "default";
    }
  }, [businessType]);

  useEffect(() => {
    const syncPreferences = () => {
      const preferences = readAppPreferences();

      setWorkspaceName(preferences.workspaceName || "Dabi Price");
      setBusinessType(preferences.businessType);
      setOperatorLabel(
        preferences.operatorEmail ||
          preferences.operatorName ||
          "Configuração pendente",
      );
    };

    syncPreferences();
    void loadAppPreferences().then(syncPreferences).catch(() => undefined);

    return subscribeAppPreferences(syncPreferences);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      // A hard reload clears workspace state held only in memory after logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  function toggleTheme() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }

  const shellToneClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[linear-gradient(180deg,rgba(254,255,254,0.96)_0%,rgba(245,252,248,0.96)_100%)] shadow-[0_18px_48px_rgba(92,154,131,0.12)]"
      : "border-[var(--panel-border)] bg-[var(--sidebar-bg)] shadow-[0_18px_48px_rgba(57,37,118,0.08)]";
  const topBarToneClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(252,255,253,0.9)] shadow-[0_12px_34px_rgba(92,154,131,0.12)]"
      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.86)] shadow-[0_12px_34px_rgba(57,37,118,0.08)]";
  const glassPanelToneClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(255,255,255,0.72)]"
      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.52)]";

  return (
    <>
      <div
        className={`fixed inset-x-0 top-0 z-40 border-b px-4 py-3 backdrop-blur-xl lg:hidden ${topBarToneClassName}`}
      >
        <div className="mx-auto flex max-w-[1488px] items-center justify-between gap-3">
          <Link href="/app" className="min-w-0" aria-label="Dabi Price">
            <DabiWordmark size="sm" />
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            aria-label="Abrir menu"
            title="Abrir menu"
          >
            ☰
          </button>
        </div>
      </div>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f0a23]/56 backdrop-blur-[3px]"
            aria-label="Fechar menu"
            onClick={() => setIsMobileOpen(false)}
          />
          <div
            className={`absolute inset-y-0 left-0 flex w-[88vw] max-w-[360px] flex-col border-r px-4 py-4 shadow-[0_24px_70px_rgba(12,8,32,0.24)] backdrop-blur-xl ${shellToneClassName}`}
          >
            <div className={`rounded-[32px] border px-4 py-5 ${glassPanelToneClassName}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DabiWordmark />
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                  aria-label="Fechar menu"
                  title="Fechar menu"
                >
                  ✕
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-1 py-5">
              <div className="space-y-6">
                {visibleSections.map((section) => (
                  <div key={section.id}>
                    {section.label ? (
                      <p
                        className={`px-3 font-mono text-[11px] uppercase tracking-[0.22em] ${
                          sidebarVariant === "confectionery"
                            ? "text-[#94b5a5]"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {section.label}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-2">
                      {section.items.map((entry) => (
                        <li key={isNavigationGroup(entry) ? entry.id : entry.href}>
                          {isNavigationGroup(entry) ? (
                            <NavigationGroupBlock
                              group={entry}
                              pathname={pathname}
                              isExpanded
                              sidebarVariant={sidebarVariant}
                              isOpen={
                                openGroups[entry.id] ||
                                entry.items.some((item) =>
                                  isNavigationItemActive(pathname, item.href),
                                )
                              }
                              onToggle={() => toggleGroup(entry.id)}
                              onItemClick={() => setIsMobileOpen(false)}
                            />
                          ) : (
                            <NavigationLink
                              item={entry}
                              pathname={pathname}
                              isExpanded
                              sidebarVariant={sidebarVariant}
                              onClick={() => setIsMobileOpen(false)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>

            <SidebarFooter
              isExpanded
              workspaceName={workspaceName}
              operatorLabel={operatorLabel}
              planLabel={planLabel}
              planPriceLabel={planPriceLabel}
              isSuperAdmin={isSuperAdmin}
              sidebarVariant={sidebarVariant}
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              onSignOut={() => void handleSignOut()}
              isSigningOut={isSigningOut}
            />
          </div>
        </div>
      ) : null}

      <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:bg-transparent lg:px-4 lg:py-4">
        <div className={`rounded-[32px] border px-4 py-5 backdrop-blur-xl ${shellToneClassName}`}>
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/app"
              className={`min-w-0 ${isExpanded ? "" : "mx-auto"}`}
              aria-label="Dabi Price"
            >
              {isExpanded ? (
                <DabiWordmark />
              ) : (
                <DabiMark size={36} title="dabi price" />
              )}
            </Link>

            {isExpanded ? (
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                aria-label="Retrair menu lateral"
                title="Retrair menu"
              >
                ←
              </button>
            ) : null}
          </div>

          {!isExpanded ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                aria-label="Expandir menu lateral"
                title="Expandir menu"
              >
                →
              </button>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-5">
          <div className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.id}>
                {isExpanded && section.label ? (
                  <p
                    className={`px-3 font-mono text-[11px] uppercase tracking-[0.22em] ${
                      sidebarVariant === "confectionery"
                        ? "text-[#94b5a5]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {section.label}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-2">
                  {section.items.map((entry) => (
                    <li key={isNavigationGroup(entry) ? entry.id : entry.href}>
                      {isNavigationGroup(entry) ? (
                        <NavigationGroupBlock
                          group={entry}
                          pathname={pathname}
                          isExpanded={isExpanded}
                          sidebarVariant={sidebarVariant}
                          isOpen={
                            openGroups[entry.id] ||
                            entry.items.some((item) =>
                              isNavigationItemActive(pathname, item.href),
                            )
                          }
                          onToggle={() =>
                            isExpanded
                              ? toggleGroup(entry.id)
                              : setIsExpanded(true)
                          }
                        />
                      ) : (
                        <NavigationLink
                          item={entry}
                          pathname={pathname}
                          isExpanded={isExpanded}
                          sidebarVariant={sidebarVariant}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <SidebarFooter
          isExpanded={isExpanded}
          workspaceName={workspaceName}
          operatorLabel={operatorLabel}
          planLabel={planLabel}
          planPriceLabel={planPriceLabel}
          isSuperAdmin={isSuperAdmin}
          sidebarVariant={sidebarVariant}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onSignOut={() => void handleSignOut()}
          isSigningOut={isSigningOut}
        />
      </aside>
    </>
  );
}

function NavigationLink({
  item,
  pathname,
  isExpanded,
  sidebarVariant = "default",
  onClick,
}: {
  item: NavigationItem;
  pathname: string;
  isExpanded: boolean;
  sidebarVariant?: SidebarVariant;
  onClick?: () => void;
}) {
  const isActive = isNavigationItemActive(pathname, item.href);
  const Icon = item.icon;
  const activeClassName =
    sidebarVariant === "confectionery"
      ? "border-[#f5bfd2] bg-[#fff0f6] font-medium text-[#cb7798]"
      : "border-[var(--accent)] bg-[var(--accent)] font-medium text-white";
  const idleClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(255,255,255,0.78)] text-[#678577] hover:border-[#b8dec9] hover:text-[#35584a]"
      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]";

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex w-full items-center rounded-[22px] border text-sm transition-colors duration-150 ${
        isActive ? activeClassName : idleClassName
      } ${isExpanded ? "justify-start px-4 py-3" : "justify-center px-2 py-2.5"}`}
      title={isExpanded ? undefined : item.label}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-current/12 ${
          isExpanded ? "mr-3 size-9 rounded-2xl" : "size-9 rounded-2xl"
        }`}
      >
        <Icon className="size-4" />
      </span>
      {isExpanded ? item.label : null}
    </Link>
  );
}

function NavigationGroupBlock({
  group,
  pathname,
  isExpanded,
  sidebarVariant,
  isOpen,
  onToggle,
  onItemClick,
}: {
  group: NavigationGroup;
  pathname: string;
  isExpanded: boolean;
  sidebarVariant: SidebarVariant;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  const isGroupActive = group.items.some((item) =>
    isNavigationItemActive(pathname, item.href),
  );
  const Icon = group.icon;
  const activeClassName =
    sidebarVariant === "confectionery"
      ? "border-[#f5bfd2] bg-[#fff0f6] text-[#cb7798]"
      : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--foreground)]";
  const idleClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(255,255,255,0.78)] text-[#678577] hover:border-[#b8dec9] hover:text-[#35584a]"
      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center rounded-[22px] border text-sm transition-colors duration-150 ${
          isGroupActive ? activeClassName : idleClassName
        } ${isExpanded ? "justify-between px-4 py-3" : "justify-center px-2 py-2.5"}`}
        title={isExpanded ? undefined : group.label}
      >
        <span className="flex min-w-0 items-center">
          <span
            className={`inline-flex shrink-0 items-center justify-center bg-current/12 ${
              isExpanded ? "mr-3 size-9 rounded-2xl" : "size-9 rounded-2xl"
            }`}
          >
            <Icon className="size-4" />
          </span>
          {isExpanded ? (
            <span className="truncate text-left">{group.label}</span>
          ) : null}
        </span>
        {isExpanded ? (
          <span className="ml-3 text-xs">{isOpen ? "−" : "+"}</span>
        ) : null}
      </button>

      {isExpanded && isOpen ? (
        <ul className="space-y-2 pl-4">
          {group.items.map((item) => (
            <li key={item.href}>
              <NavigationLink
                item={item}
                pathname={pathname}
                isExpanded
                sidebarVariant={sidebarVariant}
                onClick={onItemClick}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SidebarFooter({
  isExpanded,
  workspaceName,
  operatorLabel,
  planLabel,
  planPriceLabel,
  isSuperAdmin,
  sidebarVariant,
  themeMode,
  onToggleTheme,
  onSignOut,
  isSigningOut,
}: {
  isExpanded: boolean;
  workspaceName: string;
  operatorLabel: string;
  planLabel: string;
  planPriceLabel: string;
  isSuperAdmin: boolean;
  sidebarVariant: SidebarVariant;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  const footerToneClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_48px_rgba(92,154,131,0.12)]"
      : "border-[var(--panel-border)] bg-[var(--sidebar-bg)] shadow-[0_18px_48px_rgba(57,37,118,0.08)]";
  const softPanelClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[#f4fbf7]"
      : "border-[var(--panel-border)] bg-[var(--panel-soft)]";
  const mutedActionClassName =
    sidebarVariant === "confectionery"
      ? "border-[#e4efe9] bg-[rgba(255,255,255,0.88)] text-[#35584a] hover:border-[#f5bfd2] hover:bg-[#f8b7cb] hover:text-white"
      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white";

  return (
    <div
      className={`rounded-[32px] border px-3 py-4 text-sm text-[var(--muted)] backdrop-blur-xl ${
        footerToneClassName
      } ${
        isExpanded ? "" : "text-center"
      }`}
    >
      {isExpanded ? (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Workspace
          </p>
          <p className="mt-2 truncate text-[var(--foreground)]">{workspaceName}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {operatorLabel}
          </p>

          <div className={`mt-4 rounded-[24px] border px-4 py-4 ${softPanelClassName}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  {isSuperAdmin ? "Acesso da conta" : "Plano atual"}
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {planLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {isSuperAdmin ? planPriceLabel : `${planPriceLabel}/mês`}
                </p>
              </div>

              <Link
                href="/app/assinatura"
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${mutedActionClassName}`}
              >
                Assinatura
              </Link>
            </div>
          </div>

          <div className={`mt-4 rounded-[24px] border px-4 py-4 ${softPanelClassName}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Tema
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  Claro / Escuro
                </p>
              </div>

              <button
                type="button"
                data-theme-switch
                onClick={onToggleTheme}
                aria-label="Alternar entre modo claro e escuro"
                aria-pressed={themeMode === "dark"}
                className="relative h-7 w-12 shrink-0 rounded-full border border-[color:var(--panel-border)] bg-[var(--foreground)] transition"
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
                    themeMode === "dark" ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className={`mt-4 block rounded-full border px-4 py-2 transition ${mutedActionClassName}`}
          >
            {isSigningOut ? "Saindo..." : "Sair"}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] text-center">
            <span className="text-xs font-semibold uppercase text-[var(--foreground)]">
              {planLabel.slice(0, 2)}
            </span>
          </div>
          <Link
            href="/app/assinatura"
            className={`block rounded-full border px-3 py-2 text-xs font-semibold transition ${mutedActionClassName}`}
            title="Ver assinatura"
          >
            Assinatura
          </Link>
          <button
            type="button"
            onClick={onToggleTheme}
            className={`inline-flex h-10 w-full items-center justify-center rounded-full border transition ${mutedActionClassName}`}
            aria-label="Alternar entre modo claro e escuro"
            title="Alternar tema"
          >
            {themeMode === "dark" ? "☾" : "☀"}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className={`inline-flex h-10 w-full items-center justify-center rounded-full border transition ${mutedActionClassName}`}
            aria-label="Sair"
            title="Sair"
          >
            ⇢
          </button>
        </div>
      )}
    </div>
  );
}

function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
