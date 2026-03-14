import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [tokens, signatures, referenceFiles] = await Promise.all([
      base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id }),
      base44.entities.AccountSignature.filter({ user_id: user.id }),
      base44.entities.ReferenceFile.filter({ user_id: user.id }),
    ]);

    const accounts = tokens.map((token) => ({
      id: token.id,
      provider: token.provider,
      email: token.email,
    }));

    return Response.json({
      accounts,
      signatures,
      reference_files: referenceFiles,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});