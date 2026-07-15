"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/app-context";
import { FilterBar } from "@/components/filters/filter-bar";

// Views wired so far. Team arrives in a later phase; adding it here is a
// one-line change once its route exists.
const VIEWS = [
  { href: "/calendar", label: "Calendar" },
  { href: "/list", label: "List" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = useApp();
  const pathname = usePathname();

  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-7 pb-20">
      <header className="border-b-2 border-ink pb-3.5 mb-4">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-serif text-[34px] font-bold leading-none tracking-[-0.02em] m-0">
              Season <span className="font-light italic">Calendar</span>
            </h1>
            <div className="font-mono text-[11px] tracking-[0.09em] uppercase text-ink-60 mt-2">
              KADYLUXE · August — December 2026
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-38">
              {profile.full_name || profile.email} · {profile.role}
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className={`border border-ink px-3 py-1.5 text-[12px] font-medium hover:bg-ink hover:text-paper ${
                  pathname === "/admin" ? "bg-ink text-paper" : ""
                }`}
              >
                Admin
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="border border-ink px-3 py-1.5 text-[12px] font-medium hover:bg-ink hover:text-paper"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {pathname !== "/admin" && (
        <>
          <nav className="flex gap-0 border-b border-rule mb-[18px]" role="tablist">
            {VIEWS.map((v) => {
              const active = pathname === v.href || (v.href === "/team" && pathname.startsWith("/team"));
              return (
                <Link
                  key={v.href}
                  href={v.href}
                  role="tab"
                  aria-selected={active}
                  className={`font-serif text-[17px] font-medium mr-6 py-2 border-b-2 ${
                    active ? "text-ink border-ink" : "text-ink-38 border-transparent hover:text-ink"
                  }`}
                >
                  {v.label}
                </Link>
              );
            })}
          </nav>
          <FilterBar />
        </>
      )}

      {children}
    </div>
  );
}
