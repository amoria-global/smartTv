/**
 * Store-compliance policy flags for the TV app.
 *
 * paidPurchasesEnabled — whether the app offers an IN-APP way to BUY access to
 * paid streams: the pay-to-watch QR on the player gate + the reserve QR on the
 * event detail. Both Apple (App Store Review 3.1.1 + anti-steering) and Google
 * (Play Billing) require digital content consumed inside the app to be sold
 * through THEIR billing — an external-payment QR is a documented rejection risk.
 *
 *   • TRUE  → ship the QR purchase flow as-is. Submit with this FIRST and see
 *             if review accepts it.
 *   • FALSE → "reader mode": paid events stay visible but the purchase QR is
 *             replaced by a neutral message ("once your account has access, it
 *             unlocks here automatically"). No external link, no price CTA — the
 *             store-safe fallback if a reviewer rejects the QR.
 *
 * Either way, VERIFYING/reconciling access for someone who ALREADY paid stays
 * available (checking an existing entitlement is not a purchase).
 *
 * Hardcoded build constant on purpose: the native TV engines (Android TV /
 * Apple TV) do NOT inline process.env.NEXT_PUBLIC_* (see config/env.ts), so an
 * env-var toggle wouldn't take effect in a store build. Flip this line + rebuild.
 */
export const paidPurchasesEnabled = true;
