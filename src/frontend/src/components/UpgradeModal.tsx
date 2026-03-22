import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { LockKeyhole, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const { actor } = useActor();
  const { identity, login } = useInternetIdentity();
  const [isLoading, setIsLoading] = useState(false);
  const isLoggedIn = !!identity;

  const handleSubscribe = async () => {
    if (!actor) return;
    setIsLoading(true);
    try {
      const successUrl = `${window.location.href.split("?")[0]}?premium=success`;
      const cancelUrl = `${window.location.href.split("?")[0]}?premium=cancel`;
      const url = await actor.createCheckoutSession(
        [
          {
            productName: "HealTone Premium",
            productDescription: "Unlimited access to all healing frequencies",
            priceInCents: 499n,
            currency: "usd",
            quantity: 1n,
          },
        ],
        successUrl,
        cancelUrl,
      );
      window.location.href = url;
    } catch {
      toast.error("Checkout failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "oklch(0.08 0.03 265 / 0.7)",
            backdropFilter: "blur(8px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          data-ocid="upgrade.modal"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
            style={{
              background: "oklch(0.14 0.04 265 / 0.97)",
              border: "1px solid oklch(0.30 0.08 265)",
              boxShadow:
                "0 32px 80px oklch(0.08 0.03 265 / 0.8), 0 0 0 1px oklch(0.30 0.08 265 / 0.5)",
            }}
          >
            {/* Close */}
            <button
              type="button"
              data-ocid="upgrade.close_button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.72 0.22 290), oklch(0.60 0.22 260))",
                boxShadow: "0 0 32px oklch(0.72 0.22 290 / 0.4)",
              }}
            >
              <LockKeyhole className="w-7 h-7 text-white" />
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-1.5">
              <h2
                className="font-display text-2xl font-semibold"
                style={{ color: "oklch(0.95 0.02 240)" }}
              >
                Unlock Premium
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Access all 4 special frequencies forever
              </p>
            </div>

            {/* Features */}
            <div
              className="w-full rounded-2xl px-4 py-3 flex flex-col gap-2 text-left"
              style={{
                background: "oklch(0.18 0.04 265 / 0.6)",
                border: "1px solid oklch(0.28 0.06 265)",
              }}
            >
              {[
                { icon: "🌹", label: "Libido Booster" },
                { icon: "🧠", label: "Brain Theta Waves" },
                { icon: "🕉️", label: "OHKS Mantra Sequence" },
                { icon: "🌬️", label: "4-4-4-4 Breathwork" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-sm text-foreground/80">{f.label}</span>
                  <Sparkles
                    className="w-3 h-3 ml-auto"
                    style={{ color: "oklch(0.72 0.19 195 / 0.5)" }}
                  />
                </div>
              ))}
            </div>

            {/* Price */}
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="font-display text-4xl font-semibold"
                style={{ color: "oklch(0.88 0.10 195)" }}
              >
                $4.99
              </span>
              <span className="text-xs text-muted-foreground">per month</span>
            </div>

            {/* CTA */}
            {isLoggedIn ? (
              <button
                type="button"
                data-ocid="upgrade.primary_button"
                disabled={isLoading}
                onClick={handleSubscribe}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.72 0.22 290), oklch(0.60 0.22 260))",
                  color: "white",
                  boxShadow: "0 0 20px oklch(0.72 0.22 290 / 0.35)",
                }}
              >
                {isLoading ? "Redirecting…" : "Subscribe with Card"}
              </button>
            ) : (
              <button
                type="button"
                data-ocid="upgrade.primary_button"
                onClick={login}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.72 0.22 290), oklch(0.60 0.22 260))",
                  color: "white",
                  boxShadow: "0 0 20px oklch(0.72 0.22 290 / 0.35)",
                }}
              >
                Sign in to subscribe
              </button>
            )}

            <button
              type="button"
              data-ocid="upgrade.cancel_button"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
