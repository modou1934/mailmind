import { createHmac, timingSafeEqual } from "node:crypto";

import { fetchWithTimeout, readJsonResponse } from "./fetch.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

function trialDays() {
  return Number(process.env.STRIPE_TRIAL_DAYS || 7);
}

function discountPercent() {
  return Number(process.env.STRIPE_PRICE_DISCOUNT || 20);
}

function numericPrice(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function hasStripeCredentials() {
  return Boolean(stripeSecretKey() && process.env.STRIPE_PUBLISHABLE_KEY);
}

export function stripePlans() {
  const starterMonthly = numericPrice(process.env.STRIPE_PRICE_STARTER, 20);
  const professionalMonthly = numericPrice(process.env.STRIPE_PRICE_PROFESSIONAL, 40);
  const discount = discountPercent();
  const annualMultiplier = Math.max(0, (100 - discount) / 100) * 12;

  return {
    starter_monthly: {
      id: "starter_monthly",
      tier: "starter",
      interval: "monthly",
      label: "Starter mensile",
      price: starterMonthly,
      cadence: "mese",
      trialDays: trialDays(),
      amountCents: starterMonthly * 100,
    },
    starter_annual: {
      id: "starter_annual",
      tier: "starter",
      interval: "annual",
      label: "Starter annuale",
      price: Math.round(starterMonthly * annualMultiplier),
      cadence: "anno",
      trialDays: trialDays(),
      amountCents: Math.round(starterMonthly * annualMultiplier * 100),
    },
    professional_monthly: {
      id: "professional_monthly",
      tier: "professional",
      interval: "monthly",
      label: "Professional mensile",
      price: professionalMonthly,
      cadence: "mese",
      trialDays: trialDays(),
      amountCents: professionalMonthly * 100,
    },
    professional_annual: {
      id: "professional_annual",
      tier: "professional",
      interval: "annual",
      label: "Professional annuale",
      price: Math.round(professionalMonthly * annualMultiplier),
      cadence: "anno",
      trialDays: trialDays(),
      amountCents: Math.round(professionalMonthly * annualMultiplier * 100),
    },
  };
}

async function stripeRequest(path, body) {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const response = await fetchWithTimeout(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Stripe request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function createStripeCheckoutSession({
  tier,
  interval,
  userEmail,
  workspaceId,
  successUrl,
  cancelUrl,
}) {
  const plans = stripePlans();
  const selectedPlan = plans[`${tier}_${interval}`];
  if (!selectedPlan?.amountCents) {
    throw new Error("Missing Stripe pricing configuration for selected plan");
  }

  return stripeRequest("/checkout/sessions", {
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": `MailMind ${selectedPlan.tier === 'starter' ? 'Starter' : 'Professional'}`,
    "line_items[0][price_data][unit_amount]": String(selectedPlan.amountCents),
    "line_items[0][price_data][recurring][interval]": interval === 'annual' ? 'year' : 'month',
    "line_items[0][quantity]": "1",
    "subscription_data[trial_period_days]": String(selectedPlan.trialDays),
    "metadata[workspace_id]": workspaceId,
    "metadata[tier]": selectedPlan.tier,
    "metadata[interval]": selectedPlan.interval,
  });
}

export function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret || !rawBody || !signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    String(signatureHeader).split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.t || "";
  const signature = parts.v1 || "";
  if (!timestamp || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
