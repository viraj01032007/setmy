"use client";

import { useState } from "react";
import { Check, Crown, Zap, Heart, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RazorpayScript } from "@/components/razorpay-script";
import { useToast } from "@/hooks/use-toast";
import { startCheckout } from "@/lib/razorpay";
import { cn } from "@/lib/utils";
import { ROOMMATE_PLANS, activatePlan, type PlanId, type Quota, type RoommatePlan } from "@/lib/matching";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanId;
  onActivated: (quota: Quota) => void;
  reason?: "limit" | "chat" | "manual";
}

const ICONS: Record<PlanId, React.ReactNode> = {
  free: <Heart className="h-5 w-5" />,
  basic: <Zap className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

export function RoommatePlansModal({ isOpen, onClose, currentPlan, onActivated, reason = "manual" }: Props) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const { toast } = useToast();

  const buy = async (plan: RoommatePlan) => {
    if (plan.id === "free" || plan.id === currentPlan) return;
    setBusy(plan.id);


    onClose();
    // Give the dialog time to release its focus trap before Razorpay opens.
    window.setTimeout(async () => {
      try {
        await startCheckout({
          amount: plan.price,
          planName: `Roommate ${plan.name}`,
          description: `Roommate ${plan.name} — 1 month`,
          onSuccess: async (response) => {
            try {
              const quota = await activatePlan(plan.id, response);
              toast({ title: `${plan.name} plan active`, description: "Your daily swipes have been topped up." });
              onActivated(quota);
            } catch {
              toast({
                title: "Payment received, activation pending",
                description: "We couldn't confirm it just now. It will update shortly — contact support if not.",
                variant: "destructive",
              });
            }
          },
          onFailure: (message) => toast({ title: "Payment failed", description: message, variant: "destructive" }),
        });
      } catch (err: any) {
        toast({ title: "Payment Gateway Error", description: err?.message || "Could not start the payment.", variant: "destructive" });
      } finally {
        setBusy(null);
      }
    }, 350);
  };

  const title =
    reason === "limit" ? "You're out of swipes for today" : reason === "chat" ? "Chat with more matches" : "Roommate plans";
  const desc =
    reason === "limit"
      ? "Upgrade to keep swiping now, or come back tomorrow — your free swipes reset at midnight."
      : reason === "chat"
        ? "The Free plan lets you chat with 3 matches. Upgrade for unlimited chats."
        : "Pick how many people you want to discover every day.";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <RazorpayScript />
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-0">
        <div className="bg-ink px-6 pt-7 pb-6 text-white rounded-t-3xl">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-extrabold text-white">{title}</DialogTitle>
            <DialogDescription className="text-slate-300">{desc}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3">
          {ROOMMATE_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-5 transition-all",
                  plan.highlight ? "border-orange-400 shadow-lg shadow-orange-500/10 md:-translate-y-1" : "border-border",
                )}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2 text-primary">
                  <span className="rounded-xl bg-primary/10 p-2">{ICONS[plan.id]}</span>
                  <span className="text-lg font-bold text-foreground">{plan.name}</span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">{plan.price === 0 ? "₹0" : `₹${plan.price}`}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn("mt-5 h-11 w-full rounded-xl font-semibold", plan.highlight && !isCurrent && "bg-orange-500 hover:bg-orange-600")}
                  variant={isCurrent || plan.id === "free" ? "outline" : "default"}
                  disabled={isCurrent || plan.id === "free" || busy !== null}
                  onClick={() => buy(plan)}
                >
                  {busy === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current plan" : plan.id === "free" ? "Included" : `Get ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="px-6 pb-6 text-center text-xs text-muted-foreground">
          Secure payments by Razorpay · Plans renew monthly only if you buy again · Swipes reset every midnight
        </p>
      </DialogContent>
    </Dialog>
  );
}
