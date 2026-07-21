import type { EmailSender, OutboundEmail, OutboundSms, PmsBooking, PmsInquiry, PmsProvider, SmsSender } from "./types";

const NAME_POOL = [
  "Hannah Cole",
  "Evan Brooks",
  "Riley Chen",
  "Sam Patel",
  "Morgan Diaz",
];

export class MockPmsProvider implements PmsProvider {
  readonly name: string;
  private inquiryCount = 0;

  constructor(name = "hostfully") {
    this.name = name;
  }

  async syncInquiries(_since: Date): Promise<PmsInquiry[]> {
    // ~20% chance of a new inquiry each sync
    if (Math.random() > 0.2) return [];
    this.inquiryCount += 1;
    const name = NAME_POOL[this.inquiryCount % NAME_POOL.length]!;
    return [
      {
        externalRef: `pms_inq_${Date.now()}_${this.inquiryCount}`,
        name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        phone: undefined,
        dates: "Flexible",
        startedAt: new Date(),
        completedBooking: false,
      },
    ];
  }

  async syncBookings(_since: Date): Promise<PmsBooking[]> {
    return [];
  }
}

export class LoggingEmailSender implements EmailSender {
  async send(msg: OutboundEmail): Promise<{ providerId: string }> {
    const id = `log_email_${Date.now()}`;
    console.log("[LoggingEmailSender] EMAIL (demo — not delivered)", {
      id,
      to: msg.to,
      subject: msg.subject,
      textPreview: msg.text.slice(0, 160),
    });
    return { providerId: id };
  }
}

export class LoggingSmsSender implements SmsSender {
  async send(msg: OutboundSms): Promise<{ providerId: string }> {
    const id = `log_sms_${Date.now()}`;
    console.log("[LoggingSmsSender] SMS (demo — not delivered)", {
      id,
      to: msg.to,
      body: msg.body.slice(0, 200),
    });
    return { providerId: id };
  }
}
