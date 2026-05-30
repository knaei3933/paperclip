export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId?: string;
  date?: Date;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

function hasCredentials(): boolean {
  return !!(env('XSERVER_USER') && env('XSERVER_PASSWORD'));
}

export async function fetchUnread(): Promise<EmailMessage[]> {
  if (!hasCredentials()) {
    console.warn('[xserver] Missing XSERVER_USER/XSERVER_PASSWORD — skipping IMAP fetch');
    return [];
  }

  try {
    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host: env('XSERVER_IMAP_HOST') ?? 'sv12515.xserver.jp',
      port: parseInt(env('XSERVER_IMAP_PORT') ?? '993', 10),
      secure: true,
      auth: {
        user: env('XSERVER_USER')!,
        pass: env('XSERVER_PASSWORD')!,
      },
      logger: false as any,
    });

    const messages: EmailMessage[] = [];

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true })) {
        const envelope = msg.envelope;
        if (!envelope) continue;
        const bodyText = typeof msg.source === 'string'
          ? msg.source
          : Buffer.isBuffer(msg.source)
            ? msg.source.toString('utf-8')
            : '';

        messages.push({
          from: envelope.from?.[0]?.address ?? '',
          to: envelope.to?.[0]?.address ?? '',
          subject: envelope.subject ?? '',
          body: bodyText,
          messageId: envelope.messageId,
          date: envelope.date ?? undefined,
          attachments: [],
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return messages;
  } catch (err) {
    console.error('[xserver] IMAP fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!hasCredentials()) {
    console.warn('[xserver] Missing XSERVER_USER/XSERVER_PASSWORD — cannot send email');
    throw new Error('Email credentials not configured');
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: env('XSERVER_SMTP_HOST') ?? 'sv12515.xserver.jp',
    port: parseInt(env('XSERVER_SMTP_PORT') ?? '465', 10),
    secure: true,
    auth: {
      user: env('XSERVER_USER')!,
      pass: env('XSERVER_PASSWORD')!,
    },
  });

  await transporter.sendMail({
    from: env('XSERVER_USER')!,
    to,
    subject,
    text: body,
  });
}
