import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PremiumStatus {
  isPremium: boolean;
  trialActive: boolean;
  daysLeft: number | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function usePremium(): PremiumStatus {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const [isPremium, setIsPremium] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!actor || !identity) return;
    setIsLoading(true);
    try {
      const [trialInfo, premium] = await Promise.all([
        actor.getTrialStatus(),
        actor.checkPremiumStatus(),
      ]);
      setIsPremium(premium);
      if (trialInfo) {
        const startMs = Number(trialInfo.startTime) / 1_000_000;
        const expiresMs = startMs + 7 * 24 * 60 * 60 * 1000;
        const remaining = Math.ceil(
          (expiresMs - Date.now()) / (24 * 60 * 60 * 1000),
        );
        const active = trialInfo.isActive && remaining > 0;
        setTrialActive(active);
        setDaysLeft(active ? Math.max(1, remaining) : 0);
      } else {
        setTrialActive(false);
        setDaysLeft(null);
      }
    } catch {
      // on error, treat as loading/accessible (no false lockouts)
    } finally {
      setIsLoading(false);
    }
  }, [actor, identity]);

  useEffect(() => {
    if (!actor || !identity) {
      setIsPremium(false);
      setTrialActive(false);
      setDaysLeft(null);
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      setIsLoading(true);
      try {
        await actor.initializeTrial();
        await refresh();
      } catch {
        setIsLoading(false);
      }
    };
    void init();
  }, [actor, identity, refresh]);

  return { isPremium, trialActive, daysLeft, isLoading, refresh };
}
