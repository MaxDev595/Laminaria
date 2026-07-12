import nodemailer, { type Transporter } from "nodemailer";
import { ServiceNotConfiguredError } from "../errors.js";

export interface MailAdapter {
  readonly configured: boolean;
  sendEmailVerification(input: {
    to: string;
    name: string;
    locale: "en" | "ru";
    verificationUrl: string;
  }): Promise<void>;
  sendPasswordReset(input: {
    to: string;
    name: string;
    locale: "en" | "ru";
    resetUrl: string;
  }): Promise<void>;
  sendWebinarRegistration(input: {
    to: string;
    name: string;
    webinarTitle: string;
    locale: "en" | "ru";
    confirmationUrl: string;
  }): Promise<void>;
}

export class NotConfiguredMailAdapter implements MailAdapter {
  public readonly configured = false;

  public async sendEmailVerification(): Promise<never> {
    throw new ServiceNotConfiguredError("Mail");
  }

  public async sendPasswordReset(): Promise<never> {
    throw new ServiceNotConfiguredError("Mail");
  }

  public async sendWebinarRegistration(): Promise<never> {
    throw new ServiceNotConfiguredError("Mail");
  }
}

export class SmtpMailAdapter implements MailAdapter {
  public readonly configured = true;
  private readonly transporter: Transporter;

  public constructor(
    private readonly config: {
      host: string;
      port: number;
      secure: boolean;
      username: string | null;
      password: string | null;
      from: string;
    },
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.username
        ? { auth: { user: config.username, pass: config.password ?? "" } }
        : {}),
    });
  }

  public async sendEmailVerification(
    input: Parameters<MailAdapter["sendEmailVerification"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject:
        input.locale === "ru"
          ? "Подтвердите электронную почту в Laminaria"
          : "Verify your Laminaria email",
      text:
        input.locale === "ru"
          ? `${input.name}, подтвердите электронную почту: ${input.verificationUrl}`
          : `${input.name}, verify your email: ${input.verificationUrl}`,
    });
  }

  public async sendPasswordReset(
    input: Parameters<MailAdapter["sendPasswordReset"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject: input.locale === "ru" ? "Сброс пароля Laminaria" : "Reset your Laminaria password",
      text:
        input.locale === "ru"
          ? `${input.name}, сбросьте пароль: ${input.resetUrl}`
          : `${input.name}, reset your password: ${input.resetUrl}`,
    });
  }

  public async sendWebinarRegistration(
    input: Parameters<MailAdapter["sendWebinarRegistration"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject:
        input.locale === "ru"
          ? `Подтвердите регистрацию: ${input.webinarTitle}`
          : `Confirm your registration: ${input.webinarTitle}`,
      text:
        input.locale === "ru"
          ? `${input.name}, подтвердите регистрацию: ${input.confirmationUrl}`
          : `${input.name}, confirm your registration: ${input.confirmationUrl}`,
    });
  }

  public async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }

  private async send(message: { to: string; subject: string; text: string }): Promise<void> {
    await this.transporter.sendMail({ from: this.config.from, ...message });
  }
}

/**
 * Provider-neutral HTTP adapter kept for deployments that expose a mail relay.
 * SMTP is the local/default transport; this adapter is opt-in.
 */
export class HttpMailAdapter implements MailAdapter {
  public readonly configured = true;

  public constructor(
    private readonly config: { endpoint: string; apiKey: string; from: string },
  ) {}

  public async sendEmailVerification(
    input: Parameters<MailAdapter["sendEmailVerification"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject:
        input.locale === "ru"
          ? "Подтвердите электронную почту в Laminaria"
          : "Verify your Laminaria email",
      text:
        input.locale === "ru"
          ? `${input.name}, подтвердите электронную почту: ${input.verificationUrl}`
          : `${input.name}, verify your email: ${input.verificationUrl}`,
    });
  }

  public async sendPasswordReset(
    input: Parameters<MailAdapter["sendPasswordReset"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject: input.locale === "ru" ? "Сброс пароля Laminaria" : "Reset your Laminaria password",
      text:
        input.locale === "ru"
          ? `${input.name}, сбросьте пароль: ${input.resetUrl}`
          : `${input.name}, reset your password: ${input.resetUrl}`,
    });
  }

  public async sendWebinarRegistration(
    input: Parameters<MailAdapter["sendWebinarRegistration"]>[0],
  ): Promise<void> {
    await this.send({
      to: input.to,
      subject:
        input.locale === "ru"
          ? `Подтвердите регистрацию: ${input.webinarTitle}`
          : `Confirm your registration: ${input.webinarTitle}`,
      text:
        input.locale === "ru"
          ? `${input.name}, подтвердите регистрацию: ${input.confirmationUrl}`
          : `${input.name}, confirm your registration: ${input.confirmationUrl}`,
    });
  }

  private async send(message: { to: string; subject: string; text: string }): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: this.config.from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Mail provider rejected request with status ${response.status}`);
    }
  }
}
