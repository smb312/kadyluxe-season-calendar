"use client";

import { useQueryStates, parseAsString, parseAsBoolean, parseAsArrayOf } from "nuqs";
import { CHANNELS, MOMENT_TYPES, type Channel, type MomentType } from "@/lib/constants";

// Global, URL-backed filter state, shared across views. A filtered view is a
// shareable link (Scott sends Eric "?team=DEN&ch=paid"). Default (everything on)
// serializes to a clean URL; only narrowing shows up as query params.
export function useFilters() {
  const [state, setState] = useQueryStates(
    {
      team: parseAsString.withDefault(""),
      brand: parseAsBoolean.withDefault(false),
      ch: parseAsArrayOf(parseAsString).withDefault([...CHANNELS]),
      ty: parseAsArrayOf(parseAsString).withDefault([...MOMENT_TYPES]),
      scope: parseAsString.withDefault("all"),
    },
    { history: "replace", clearOnDefault: true },
  );

  const channels = new Set(state.ch as Channel[]);
  const types = new Set(state.ty as MomentType[]);

  function toggleChannel(c: Channel) {
    const next = new Set(channels);
    next.has(c) ? next.delete(c) : next.add(c);
    setState({ ch: CHANNELS.filter((x) => next.has(x)) });
  }
  function toggleType(t: MomentType) {
    const next = new Set(types);
    next.has(t) ? next.delete(t) : next.add(t);
    setState({ ty: MOMENT_TYPES.filter((x) => next.has(x)) });
  }
  // Team and brand-wide-only are mutually exclusive (mirrors the prototype).
  function setTeam(code: string) {
    setState({ team: code, brand: code ? false : state.brand });
  }
  function setBrandOnly(on: boolean) {
    setState({ brand: on, team: on ? "" : state.team });
  }
  function setScope(scope: string) {
    setState({ scope });
  }
  function reset() {
    setState({ team: "", brand: false, ch: [...CHANNELS], ty: [...MOMENT_TYPES] });
  }

  return {
    team: state.team,
    brandOnly: state.brand,
    scope: state.scope,
    channels,
    types,
    isChannelOn: (c: Channel) => channels.has(c),
    isTypeOn: (t: MomentType) => types.has(t),
    toggleChannel,
    toggleType,
    setTeam,
    setBrandOnly,
    setScope,
    reset,
  };
}

export type Filters = ReturnType<typeof useFilters>;
