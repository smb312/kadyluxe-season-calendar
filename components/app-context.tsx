"use client";

import { createContext, useContext } from "react";
import type { Profile, Team } from "@/lib/types";

interface AppContextValue {
  profile: Profile;
  teams: Team[];
  teamsByCode: Record<string, Team>;
  canWrite: boolean;
  isAdmin: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  profile,
  teams,
  children,
}: {
  profile: Profile;
  teams: Team[];
  children: React.ReactNode;
}) {
  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  const canWrite = profile.role === "admin" || profile.role === "editor";
  const isAdmin = profile.role === "admin";
  return (
    <AppContext.Provider value={{ profile, teams, teamsByCode, canWrite, isAdmin }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Convenience helpers for team color/name lookups.
export function useTeamLookup() {
  const { teamsByCode } = useApp();
  return {
    color: (code: string) => teamsByCode[code]?.color ?? "#999",
    name: (code: string) => teamsByCode[code]?.name ?? code,
  };
}
