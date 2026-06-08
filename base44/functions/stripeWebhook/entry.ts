import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    createClientFromRequest(req);

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      return Response.json(
        { error: 'Stripe webhook not configured yet: missing STRIPE_WEBHOOK_SECRET' },
        { status: 503 },
      );
    }

    return Response.json(
      { message: 'Stripe webhook endpoint is ready for final configuration' },
      { status: 200 },
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});