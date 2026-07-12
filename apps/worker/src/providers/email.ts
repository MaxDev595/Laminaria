import nodemailer, { type Transporter } from "nodemailer";
import type { WorkerConfig } from "../config.js";
import { ServiceNotConfiguredError } from "../errors.js";

export interface EmailProvider {
  readonly configured: boolean;
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<{ messageId: string }>;
}

class DisabledEmailProvider implements EmailProvider {
  readonly configured = false;

  send(): Promise<{ messageId: string }> {
    return Promise.reject(new ServiceNotConfiguredError("email"));
  }
}

class SmtpEmailProvider implements EmailProvider {
  readonly configured = true;

  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async send(message: { to: string; subject: string; text: string; html?: string }) {
    const result = await this.transporter.sendMail({ from: this.from, ...message });
    return { messageId: result.messageId };
  }
}

export function createEmailProvider(config: WorkerConfig): EmailProvider {
  if (!config.SMTP_HOST) return new DisabledEmailProvider();
  const auth = config.SMTP_USER
    ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" }
    : undefined;
  return new SmtpEmailProvider(
    nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth,
    }),
    config.EMAIL_FROM,
  );
}
