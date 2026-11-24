export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  from: string;
  /** Stable key so retries / crash recovery do not create duplicate deliveries. */
  idempotencyKey?: string;
};

export type EmailSendResult = {
  ok: boolean;
  /** Temporary vs permanent failure for retry policy. */
  permanent?: boolean;
  providerResponse?: string;
  errorMessage?: string;
  /** True when the transport skipped a real send because the key was already accepted. */
  deduplicated?: boolean;
};

export type EmailTransport = {
  send(message: EmailMessage): Promise<EmailSendResult>;
};

/** In-process dedupe for console transport (tests / local worker). */
const consoleAcceptedKeys = new Set<string>();

/** Test helper — clear console transport idempotency cache. */
export function resetConsoleEmailIdempotency(): void {
  consoleAcceptedKeys.clear();
}

/** Development / test transport — never leaves the process. */
export function createConsoleEmailTransport(): EmailTransport {
  return {
    async send(message) {
      const key = message.idempotencyKey;
      if (key && consoleAcceptedKeys.has(key)) {
        return {
          ok: true,
          deduplicated: true,
          providerResponse: `console:deduped:${key}`,
        };
      }
      console.log(
        `[email:console] to=${message.to} subject=${JSON.stringify(message.subject)}`,
      );
      if (key) {
        consoleAcceptedKeys.add(key);
      }
      return {
        ok: true,
        providerResponse: key ? `console:accepted:${key}` : "console:accepted",
      };
    },
  };
}

export type SmtpTransportConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure?: boolean;
};

/**
 * Minimal SMTP adapter via dynamic nodemailer import when available.
 * Uses a deterministic Message-ID from the idempotency key when provided.
 */
export function createSmtpEmailTransport(
  config: SmtpTransportConfig,
): EmailTransport {
  return {
    async send(message) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure ?? config.port === 465,
          auth:
            config.user && config.password
              ? { user: config.user, pass: config.password }
              : undefined,
        });
        const messageId = message.idempotencyKey
          ? `<${message.idempotencyKey.replace(/[^a-zA-Z0-9._-]/g, "_")}@plexsol.local>`
          : undefined;
        const info = await transporter.sendMail({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text ?? undefined,
          ...(messageId
            ? {
                messageId,
                headers: {
                  "X-Plexsol-Idempotency-Key": message.idempotencyKey!,
                },
              }
            : {}),
        });
        return {
          ok: true,
          providerResponse: info.messageId ?? JSON.stringify(info),
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "SMTP send failed";
        const permanent =
          /invalid|auth|recipient|mailbox unavailable|550|553/i.test(
            errorMessage,
          );
        return {
          ok: false,
          permanent,
          errorMessage,
        };
      }
    },
  };
}

export function createEmailTransport(options: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}): EmailTransport {
  if (!options.smtpHost) {
    return createConsoleEmailTransport();
  }
  return createSmtpEmailTransport({
    host: options.smtpHost,
    port: options.smtpPort ?? 587,
    user: options.smtpUser,
    password: options.smtpPassword,
  });
}
