"use client";

import { SessionProvider } from "next-auth/react";
import { FilterProvider } from "@/lib/FilterContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <FilterProvider>
                {children}
            </FilterProvider>
        </SessionProvider>
    );
}
