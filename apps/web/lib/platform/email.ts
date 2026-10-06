import { brand } from '@tianji/shared/brand';
import type { SendEmail } from '@cloudflare/workers-types';
import { cloudflareBindings } from './cloudflare';
import { platform } from './environment';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
export interface EmailFrom {
  email: string;
  name: string;
}

/** Resolve the verified sender address and display name from server-only configuration. */
export function emailFrom(env: Record<string, string | undefined> = process.env): EmailFrom {
  // DESIGN-GAP: EMAIL_FROM stays an address; EMAIL_FROM_NAME configures the display name independently, with brand-derived defaults.
  return {
    email: env.EMAIL_FROM || 'noreply@send.gavin.pub',
    name: env.EMAIL_FROM_NAME || `${brand.nameZh} ${brand.nameEn}`,
  };
}

/** Send through the request's native Email Service binding, propagating provider errors for retries. */
export class CloudflareEmailSender implements EmailSender {
  constructor(
    private readonly binding: SendEmail,
    private readonly from: EmailFrom,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    await this.binding.send({ ...message, from: this.from });
  }
}

/** Capture local mail without delivery; an optional loopback outbox connects isolated browser tests. */
export class MockEmailSender implements EmailSender {
  readonly outbox: (EmailMessage & { from: EmailFrom })[] = [];
  private readonly endpoint?: URL;

  constructor(
    private readonly from: EmailFrom,
    endpoint?: string,
  ) {
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        url.username ||
        url.password ||
        url.pathname !== '/mail' ||
        url.search ||
        url.hash
      )
        throw new Error('Mock mail sink must use HTTP loopback /mail');
      this.endpoint = url;
    }
  }

  async send(message: EmailMessage): Promise<void> {
    const payload = { ...message, from: { ...this.from } };
    if (this.endpoint) {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Mock mail delivery failed');
    }
    // DESIGN-GAP: The local outbox retains only the latest 100 messages in memory and never logs login tokens or recipients.
    this.outbox.push(payload);
    if (this.outbox.length > 100) this.outbox.shift();
  }
}

let localSender: MockEmailSender | undefined;
let localConfiguration = '';

/** Select the request-scoped Cloudflare sender or a local mock; Workers never fall back to mock delivery. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const from = emailFrom();
  if (platform() === 'cloudflare') {
    const binding = (await cloudflareBindings()).EMAIL;
    if (!binding) throw new Error('EMAIL binding required');
    return new CloudflareEmailSender(binding, from).send(message);
  }
  // DESIGN-GAP: Node production builds are used only by isolated E2E; require explicit test mode, isolated auth secret and a loopback origin/sink before mock delivery.
  if (process.env.NODE_ENV === 'production') {
    const origin = new URL(process.env.AUTH_URL || 'https://invalid.example');
    if (
      process.env.TEST_WEB_MODE !== 'production' ||
      !process.env.AUTH_SECRET?.startsWith('isolated-') ||
      origin.protocol !== 'http:' ||
      !['localhost', '127.0.0.1'].includes(origin.hostname) ||
      !process.env.TEST_MAIL_URL
    )
      throw new Error('Cloudflare EMAIL binding required in production');
  }
  const configuration = JSON.stringify([from, process.env.TEST_MAIL_URL]);
  if (!localSender || localConfiguration !== configuration) {
    localSender = new MockEmailSender(from, process.env.TEST_MAIL_URL);
    localConfiguration = configuration;
  }
  await localSender.send(message);
}
