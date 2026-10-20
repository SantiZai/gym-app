"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User as UserIcon, LogOut, ChevronDown } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { clearActiveSession } from "@/lib/activeSession";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_VERSION } from "@/lib/version";
import { CafecitoMenuCard, CafecitoDropdownItem } from "@/components/cafecito-button";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/rutinas", label: "Rutinas" },
  { href: "/gimnasios", label: "Gimnasios" },
  { href: "/comunidad", label: "Comunidad" },
  { href: "/progreso", label: "Progreso" },
  { href: "/perfil", label: "Perfil" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Chequear si un link está activo
  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  // Solo sombra al scrollear. Sin auto-hide: en iOS el translate de una
  // barra fixed genera ghosting/blur y deja el logo a medio tapar por la isla.
  // La nav queda siempre visible (como en desktop).
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Offset para headers sticky: altura de la nav + safe-area de la isla.
  // Constante porque la nav ya no se auto-oculta.
  useEffect(() => {
    const value = "calc(4rem + env(safe-area-inset-top, 0px))";
    document.documentElement.style.setProperty("--nav-top", value);
  }, []);

  // Prevenir scroll del body cuando el menú está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Cerrar menú/dropdown al cambiar de ruta y liberar el scroll.
  // Sin esto, si se navega con el drawer abierto (ej. logout -> redirect a "/"),
  // el `overflow: hidden` y el overlay quedaban activos y la app parecía
  // "trabada": no se podía navegar sin recargar.
  useEffect(() => {
    setIsOpen(false);
    setIsDropdownOpen(false);
    document.body.style.overflow = "";
  }, [pathname]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSignOut = async () => {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
      clearActiveSession();
      setIsOpen(false);
      setIsDropdownOpen(false);
      document.body.style.overflow = "";
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <nav
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className={`fixed inset-x-0 top-0 z-50 bg-white border-b border-transparent transition-shadow duration-200 ${scrolled ? "shadow-md border-slate-100" : ""
          }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop */}
          <div className="hidden md:flex items-center justify-between h-16">
            {/* Logo a la izquierda - Desktop */}
            <Link href="/" className="flex items-center space-x-2">
              <Image src="/icons/icon.svg" alt="Habitus" width={32} height={32} className="rounded-lg" />
              <span className="text-xl font-bold text-slate-900">Habitus</span>
            </Link>

            {/* Links y perfil - Desktop */}
            <div className="flex items-center gap-4 lg:gap-6">
              {user && navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-medium transition-colors duration-200 ${isActiveLink(link.href)
                    ? "text-blue-600 font-semibold"
                    : "text-slate-700 hover:text-blue-600"
                    }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Dropdown de usuario - Desktop */}
              <ThemeToggle />
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    aria-label="Abrir menú de usuario"
                    aria-expanded={isDropdownOpen}
                    className="flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-blue-400/10 transition-colors duration-200 cursor-pointer"
                  >
                    {user?.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.name || "User"}
                        width={32}
                        height={32}
                        className="rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {user?.name || "Usuario"}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? "rotate-180" : ""
                      }`} />
                  </button>

                  {/* Dropdown menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                      <CafecitoDropdownItem />
                      <div className="border-t border-slate-200 my-1"></div>
                      <Link
                        href="/perfil"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-200"
                      >
                        <UserIcon className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">Información personal</span>
                      </Link>
                      <div className="border-t border-slate-200 my-1"></div>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-red-50 transition-colors duration-200 w-full text-left cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">Cerrar sesión</span>
                      </button>
                      <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-1">
                        <Link
                          href="/privacidad"
                          onClick={() => setIsDropdownOpen(false)}
                          className="text-sm font-medium text-slate-700 hover:text-blue-600"
                        >
                          Privacidad
                        </Link>
                        <Link
                          href="/terminos"
                          onClick={() => setIsDropdownOpen(false)}
                          className="text-sm font-medium text-slate-700 hover:text-blue-600"
                        >
                          Términos y condiciones
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                >
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>

          {/* Mobile: grid sin translate para texto nítido en iOS */}
          <div className="grid md:hidden grid-cols-[1fr_auto_1fr] items-center h-16">
            <div className="w-10" />
            <Link href="/" className="flex items-center justify-center space-x-2">
              <Image src="/icons/icon.svg" alt="Habitus" width={32} height={32} className="rounded-lg" />
              <span className="text-xl font-bold text-slate-900">Habitus</span>
            </Link>
            <div className="flex items-center justify-end gap-1">
              <ThemeToggle />
              {
                user ? (
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                    aria-label="Toggle menu"
                  >
                    {isOpen ? (
                      <X className="h-6 w-6 text-slate-700" />
                    ) : (
                      <Menu className="h-6 w-6 text-slate-700" />
                    )}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                    aria-label="Iniciar sesión"
                  >
                    <UserIcon className="h-6 w-6 text-slate-700" />
                  </Link>
                )
              }
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay oscuro */}
      <div
        className={`fixed inset-0 bg-black/50 z-[45] transition-opacity duration-300 md:hidden ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Menú lateral - Mobile */}
      <div
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        className={`fixed top-0 right-0 h-[100dvh] w-[280px] bg-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header del menú */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2 px-4">
            <Image src="/icons/icon.svg" alt="Habitus" width={28} height={28} className="rounded-lg" />
            <span className="text-lg font-bold text-slate-900">Habitus</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-slate-700" />
          </button>
        </div>

        {/* Links del menú */}
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${isActiveLink(link.href)
                    ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600 font-semibold"
                    : "text-slate-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:text-blue-600"
                    }`}
                >
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isActiveLink(link.href) ? "bg-blue-600" : "bg-slate-400 group-hover:bg-blue-600"
                    }`}></span>
                  <span className="flex-1">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer del menú */}
        <div className="mt-auto p-4 border-t bg-white">
          {user ? (
            <div className="space-y-2">
              <CafecitoMenuCard onClick={() => setIsOpen(false)} />
              <Link
                href="/perfil"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                <div className="relative flex-shrink-0">
                  {user?.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.name || "User"}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {user?.name || "Usuario"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleSignOut();
                }}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 transition-colors duration-200 w-full text-left"
              >
                <LogOut className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Cerrar sesión</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <CafecitoMenuCard onClick={() => setIsOpen(false)} />
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full px-4 py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
              >
                Iniciar sesión
              </Link>
            </div>
          )}
          <div className="text-center text-xs text-slate-600 mt-2 flex flex-col gap-1 items-start">
            <a href="/privacidad" className="hover:text-blue-600 underline-none">Privacidad</a>
            <a href="/terminos" className="hover:text-blue-600 underline-none">Términos y condiciones</a>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">{APP_VERSION}</p>
        </div>
      </div>
    </>
  );
}
