import type React from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { TbFileDescription, TbList, TbListDetails, TbPlus } from "react-icons/tb";
import { Navbar as UINavbar, type NavItem, type NavSection } from "@rymel/ui";
import type { Role } from "../../commons/types";
import { useAuth } from "../../context/AuthContext";

/**
 * Barra del cliente: aquí solo vive qué secciones hay, quién las ve y cuándo
 * están encendidas. El aspecto lo pone `Navbar` de @rymel/ui.
 */

interface SectionConfig {
  label: string;
  icon: ReactNode;
  /** Rutas que encienden la sección en la barra. */
  isActive: (pathname: string) => boolean;
  /** Sin roles, la ve cualquiera con sesión. */
  roles?: Role[];
  href?: string;
  items?: Omit<NavItem, "active">[];
}

const icon = (Icon: React.ComponentType<{ className?: string }>) => (
  <Icon className="h-[18px] w-[18px]" />
);

const SECTIONS: SectionConfig[] = [
  {
    label: "Normas",
    icon: icon(TbListDetails),
    href: "/",
    roles: ["ADMIN", "NORM"],
    isActive: (pathname) => pathname === "/" || pathname.startsWith("/norms"),
  },
  {
    label: "Diseño",
    icon: icon(TbFileDescription),
    isActive: (pathname) =>
      pathname.startsWith("/design") || pathname.startsWith("/elements/design"),
    items: [
      {
        href: "/design/list",
        label: "Todos los diseños",
        description: "Busca y filtra la biblioteca",
        icon: icon(TbList),
      },
      {
        href: "/design",
        label: "Nuevo diseño",
        description: "Empieza un diseño desde cero",
        icon: icon(TbPlus),
      },
    ],
  },
];

/** Lo que se puede crear desde cualquier pantalla, con el botón «Crear». */
const CREATE_ACTIONS: (NavItem & { roles?: Role[] })[] = [
  {
    href: "/design",
    label: "Nuevo diseño",
    description: "Con elementos y sub-diseños",
    icon: icon(TbFileDescription),
    roles: ["ADMIN", "DESIGN"],
  },
  {
    href: "/norms/new",
    label: "Nueva norma",
    description: "Registrar una norma técnica",
    icon: icon(TbListDetails),
    roles: ["ADMIN", "NORM"],
  },
];

const Navbar: React.FC = () => {
  const { hasRole, user, logout } = useAuth();
  const { pathname } = useLocation();

  const allowed = (entry: { roles?: Role[] }) =>
    !entry.roles || hasRole(...entry.roles);

  const sections: NavSection[] = SECTIONS.filter(allowed).map(
    ({ isActive, items, ...section }) => ({
      ...section,
      active: isActive(pathname),
      items: items?.map((item) => ({ ...item, active: item.href === pathname })),
    }),
  );
  const home = sections[0]?.href ?? sections[0]?.items?.[0]?.href ?? "/";
  const email = user?.email ?? "";

  return (
    <UINavbar
      brand={{ href: home }}
      sections={sections}
      createActions={CREATE_ACTIONS.filter(allowed).map(
        ({ roles: _roles, ...action }) => action,
      )}
      user={
        user
          ? { name: email.split("@")[0], email, roles: user.roles }
          : undefined
      }
      onLogout={logout}
    />
  );
};

export default Navbar;
