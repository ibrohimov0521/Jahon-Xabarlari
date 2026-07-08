"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type Sheet = "categories" | "saved" | "more" | null;

type NavContextValue = {
  sheet: Sheet;
  setSheet: Dispatch<SetStateAction<Sheet>>;
};

const NavContext = createContext<NavContextValue | null>(null);

/** Shared bottom-nav sheet state so both the BottomNav bar and SwipeNav can
 *  drive which of the 5 tabs is open. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  return <NavContext.Provider value={{ sheet, setSheet }}>{children}</NavContext.Provider>;
}

export function useNav() {
  const value = useContext(NavContext);
  if (!value) throw new Error("useNav must be used inside NavProvider");
  return value;
}
