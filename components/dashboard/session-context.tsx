"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getMe, getToken } from "@/lib/api";

export type MeResponse = {
  role: "seller" | "buyer";
  profile: {
    id: string;
    name?: string;
    email: string;
    phone?: string;
    business_name?: string;
    bvn?: string;
    settlement?: { bankCode: string; accountNumber: string } | null;
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

type SessionContextValue = SessionState & {
  /** Re-fetches /auth/me after a profile update (e.g. setup card). */
  refresh: () => void;
};

const SessionContext = createContext<SessionContextValue>({
  status: "loading",
  refresh: () => {},
});

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
        router.replace(signinUrl());
        return;
      }

      try {
        const data = (await getMe()) as MeResponse;
        if (cancelled) return;

        setState({ status: "authed", data });
      } catch {
        if (cancelled) return;
        setState({ status: "error" });
        toast.error("Your session expired. Please sign in again.");
        router.replace(signinUrl());
      }
    }

    function signinUrl() {
      const next =
        typeof window === "undefined"
          ? "/dashboard"
          : window.location.pathname + window.location.search;
      return `/signin?next=${encodeURIComponent(next)}`;
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const refresh = useCallback(() => {
    if (!getToken()) return;
    getMe()
      .then((data) => setState({ status: "authed", data: data as MeResponse }))
      .catch(() => {
        /* keep current session — next full load handles expiry */
      });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, refresh }),
    [state, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useRequireSeller() {
  const router = useRouter();
  const session = useDashboardSession();

  useEffect(() => {
    if (session.status === "authed" && session.data.role === "buyer") {
      toast.info("That page is for sellers only. Taking you home.");
      router.replace("/dashboard");
    }
  }, [session, router]);
}

export function useRequireBuyer() {
  const router = useRouter();
  const session = useDashboardSession();

  useEffect(() => {
    if (session.status === "authed" && session.data.role === "seller") {
      toast.info("That page is for buyers only. Taking you home.");
      router.replace("/dashboard");
    }
  }, [session, router]);
}
