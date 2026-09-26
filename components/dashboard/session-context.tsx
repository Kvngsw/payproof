"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getMe, getToken } from "@/lib/api/mock";

export type MeResponse = {
  role: "seller" | "buyer";
  profile: {
    id: string;
    name?: string;
    email: string;
    phone?: string;
    business_name?: string;
    created_at?: string;
  };
  reserved_account?: {
    account_number: string;
    bank_name: string;
    account_name: string;
  };
};

type SessionState =
  | { status: "loading" }
  | { status: "authed"; data: MeResponse }
  | { status: "error" };

const SessionContext = createContext<SessionState>({ status: "loading" });

export function useDashboardSession() {
  return useContext(SessionContext);
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!getToken()) {
        if (!cancelled) setState({ status: "error" });
        toast.error("Please sign in to access the dashboard");
        router.replace("/signin");
        return;
      }

      try {
        const data = (await getMe()) as MeResponse;
        if (cancelled) return;

        if (data.role === "buyer") {
          toast.info("The buyer dashboard isn't built yet. Taking you home.");
          router.replace("/");
          return;
        }

        setState({ status: "authed", data });
      } catch {
        if (cancelled) return;
        setState({ status: "error" });
        toast.error("Your session expired. Please sign in again.");
        router.replace("/signin");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
