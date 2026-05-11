type Env = {
  AUTH_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  SEND_EMAIL_HOOK_SECRET?: string;
  VITE_SUPABASE_URL?: string;
};

type SupabaseEmailAction =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

type SupabaseEmailPayload = {
  user: {
    email?: string;
    new_email?: string;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    email_action_type: SupabaseEmailAction;
  };
};

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function verifyStandardWebhook(request: Request, rawBody: string, secret: string) {
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new Error("Missing webhook signature headers");
  }

  const timestamp = Number(webhookTimestamp);
  const fiveMinutes = 5 * 60;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > fiveMinutes) {
    throw new Error("Webhook timestamp is outside the allowed window");
  }

  const secretValue = secret.replace(/^v1,whsec_/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent)));

  const signatures = webhookSignature.split(" ").flatMap((part) => {
    const signature = part.trim();
    if (!signature.startsWith("v1,")) return [];
    try {
      return [base64ToBytes(signature.slice(3))];
    } catch {
      return [];
    }
  });

  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) {
    throw new Error("Invalid webhook signature");
  }
}

function verifyUrl(env: Env, tokenHash: string, actionType: SupabaseEmailAction, redirectTo?: string) {
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is not configured");

  const url = new URL(`${supabaseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function getCopy(actionType: SupabaseEmailAction) {
  switch (actionType) {
    case "recovery":
      return {
        subject: "Reset your Buddies Worldwide password",
        heading: "Reset your password",
        body: "Use this secure link to choose a new password for your Buddies Worldwide account.",
        button: "Reset password",
      };
    case "magiclink":
      return {
        subject: "Sign in to Buddies Worldwide",
        heading: "Sign in to Buddies Worldwide",
        body: "Use this secure link to sign in to your Buddies Worldwide account.",
        button: "Sign in",
      };
    case "invite":
      return {
        subject: "You have been invited to Buddies Worldwide",
        heading: "Join Buddies Worldwide",
        body: "Use this secure link to accept your invitation and open your account.",
        button: "Accept invite",
      };
    case "email_change":
      return {
        subject: "Confirm your Buddies Worldwide email change",
        heading: "Confirm your email change",
        body: "Use this secure link to confirm this email address for your Buddies Worldwide account.",
        button: "Confirm email",
      };
    default:
      return {
        subject: "Confirm your Buddies Worldwide email",
        heading: "Confirm your email",
        body: "Use this secure link to confirm your email address and open your Buddies Worldwide account.",
        button: "Confirm email",
      };
  }
}

function renderEmail(actionType: SupabaseEmailAction, confirmationUrl: string): Omit<EmailMessage, "to"> {
  const copy = getCopy(actionType);
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#fff8f2;font-family:Inter,Arial,sans-serif;color:#2b211b;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #f0ded2;border-radius:18px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#25351f;">${copy.heading}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4a3a30;">${copy.body}</p>
        <p style="margin:0 0 24px;">
          <a href="${confirmationUrl}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1;padding:16px 24px;border-radius:999px;">${copy.button}</a>
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#7b6658;">If the button does not work, copy and paste this link into your browser:<br>${confirmationUrl}</p>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject: copy.subject,
    html,
    text: `${copy.heading}\n\n${copy.body}\n\n${confirmationUrl}`,
  };
}

function buildMessages(payload: SupabaseEmailPayload, env: Env): EmailMessage[] {
  const { user, email_data: emailData } = payload;
  const redirectTo = emailData.redirect_to || emailData.site_url;
  const actionType = emailData.email_action_type;

  if (actionType === "email_change" && emailData.token_hash_new && user.email) {
    const currentEmailUrl = verifyUrl(env, emailData.token_hash_new, actionType, redirectTo);
    const currentEmail = renderEmail(actionType, currentEmailUrl);
    const messages: EmailMessage[] = [{ ...currentEmail, to: user.email }];

    if (emailData.token_hash && user.new_email) {
      const newEmailUrl = verifyUrl(env, emailData.token_hash, actionType, redirectTo);
      messages.push({ ...renderEmail(actionType, newEmailUrl), to: user.new_email });
    }

    return messages;
  }

  const to = user.new_email || user.email;
  const tokenHash = emailData.token_hash || emailData.token_hash_new;
  if (!to || !tokenHash) throw new Error("Email payload is missing recipient or token hash");

  return [{ ...renderEmail(actionType, verifyUrl(env, tokenHash, actionType, redirectTo)), to }];
}

async function sendEmail(env: Env, message: EmailMessage) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  if (!env.AUTH_EMAIL_FROM) throw new Error("AUTH_EMAIL_FROM is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.SEND_EMAIL_HOOK_SECRET) throw new Error("SEND_EMAIL_HOOK_SECRET is not configured");

    const rawBody = await request.text();
    await verifyStandardWebhook(request, rawBody, env.SEND_EMAIL_HOOK_SECRET);

    const payload = JSON.parse(rawBody) as SupabaseEmailPayload;
    const messages = buildMessages(payload, env);
    await Promise.all(messages.map((message) => sendEmail(env, message)));

    return json({});
  } catch (error: any) {
    return json({ error: { message: error.message || "Email hook failed" } }, 401);
  }
};

export const onRequest: PagesFunction<Env> = async () => {
  return json({ error: { message: "Method not allowed" } }, 405);
};
