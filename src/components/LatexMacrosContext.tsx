"use client";

import { createContext, useContext } from "react";
import useSWR from "swr";

type Macros = Record<string, string>;

const LatexMacrosContext = createContext<Macros>({});

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LatexMacrosProvider({ children }: { children: React.ReactNode }) {
  const { data } = useSWR<Macros>("/api/settings/latex-macros", fetcher);
  return (
    <LatexMacrosContext.Provider value={data ?? {}}>
      {children}
    </LatexMacrosContext.Provider>
  );
}

export function useLatexMacros(): Macros {
  return useContext(LatexMacrosContext);
}
