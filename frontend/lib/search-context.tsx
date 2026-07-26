"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type SearchContextValue = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

/** Global search state so any button (header, bottom nav) and Ctrl/⌘+K open the
 *  same premium search experience, rendered once in the layout. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = pathname.startsWith("/admin");
  const openSearch = useCallback(() => {
    if (!isAdmin) setOpen(true);
  }, [isAdmin]);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (isAdmin) {
      setOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  return <SearchContext.Provider value={{ open, openSearch, closeSearch }}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearch must be used inside SearchProvider");
  return value;
}
