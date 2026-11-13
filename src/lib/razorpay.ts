import api from "@/lib/api";

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

/** Loads Razorpay's checkout script and waits until `window.Razorpay` really exists. */
export function loadRazorpay(timeoutMs = 15000): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if ((window as any).Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    let script = document.getElementById("razorpay-checkout-js") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    const started = Date.now();
    const check = () => {
      if ((window as any).Razorpay) return resolve();
      if (Date.now() - started > timeoutMs) {
        loading = null;
        return reject(new Error("razorpay-script"));
      }
      window.setTimeout(check, 100);
    };
    script.addEventListener("error", () => { loading = null; reject(new Error("razorpay-script")); });
    check();
  });
  return loading;
}

export interface CheckoutOptions {
  amount: number; // rupees
  planName: string;
  description?: string;
  propertyId?: string | null;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void | Promise<void>;
  onFailure?: (message: string) => void;
  onDismiss?: () => void;
}

/**
 * Creates the order on our backend, then opens Razorpay.
 * Throws an Error whose message is a friendly sentence you can show in a toast.
 */
export async function startCheckout(opts: CheckoutOptions) {
  try {
    await loadRazorpay();
  } catch {
    throw new Error("Couldn't load Razorpay. Check your internet connection or disable any ad-blocker, then try again.");
  }

  let data: any;
  try {
    ({ data } = await api.post("/payments/create-order/", {
      amount: opts.amount,
      property_id: opts.propertyId ?? null,
      plan_name: opts.planName,
    }));
  } catch (err: any) {
    const code = err?.response?.status;
    if (!err?.response) throw new Error("Can't reach the SetMyStay server right now. Please try again in a minute.");
    if (code === 401) throw new Error("Please sign in first, then try the payment again.");
    throw new Error(err.response.data?.error || err.response.data?.detail || `Server error (${code}) while creating the order.`);
  }

  const key = data?.razorpay_key || import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key || !data?.order_id) {
    throw new Error("Payments aren't set up on the server yet (Razorpay keys missing). Please contact support.");
  }

  const rzp = new (window as any).Razorpay({
    key,
    amount: data.amount,
    currency: data.currency || "INR",
    name: "SetMyStay",
    description: opts.description || opts.planName,
    order_id: data.order_id,
    prefill: opts.prefill,
    theme: { color: "#1d4ed8" },
    handler: opts.onSuccess,
    modal: { ondismiss: () => opts.onDismiss?.() },
  });
  rzp.on("payment.failed", (r: any) => opts.onFailure?.(r?.error?.description || "The payment was declined."));
  rzp.open();
}
