"use client";

import { createContext, useContext } from "react";
import type { User, Workspace } from "@/lib/api";

export interface DashboardContextValue {
  user: User;
  workspace: Workspace;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardContextProvider = DashboardContext.Provider;

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside DashboardShell");
  return value;
}
