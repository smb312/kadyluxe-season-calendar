"use client";

import { createContext, useContext } from "react";
import type { MemberDirectory, Profile, Team } from "@/lib/types";

interface AppContextValue {
  profile: Profile;
  teams: Team[];
  teamsByCode: Record<string, Team>;
  directory: MemberDirectory;
  canWrite: boolean;
  isAdmin: boolean;
  memberName: (id: string | null | undefined) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  profile,
  teams,
  directory,
  children,
}: {
  profile: Profile;
  teams: Team[];
  directory: MemberDirectory;
  children: React.ReactNode;
}) {
  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  const canWrite = profile.role === "admin" || profile.role === "editor";
  const isAdmin = profile.role === "admin";
  const memberName = (id: string | null | undefined) =>
    (id && (directory[id] || (id === profile.id ? profile.full_name || profile.email : ""))) || "Someone";
  return (
    <AppContext.Provider value={{ profile, teams, teamsByCode, directory, canWrite, isAdmin, memberName }}>
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
