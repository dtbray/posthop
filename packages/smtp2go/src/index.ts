export interface Message {
  recipient: string;
  sender: string;
  senderName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  batchId: string;
  recipientId: string;
}
export type SendResult =
  | { kind: "accepted"; providerId: string }
  | { kind: "retry"; reason: string }
  | { kind: "rejected"; reason: string }
  | { kind: "unknown"; reason: string };
export interface MailProvider {
  send(message: Message): Promise<SendResult>;
}
export class MockProvider implements MailProvider {
  async send(message: Message): Promise<SendResult> {
    return { kind: "accepted", providerId: `mock-${message.recipientId}` };
  }
}
export class Smtp2goProvider implements MailProvider {
  constructor(
    private apiKey: string,
    private transport: typeof fetch = fetch,
  ) {}
  async send(message: Message): Promise<SendResult> {
    try {
      const response = await this.transport("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Content-Type": "application/json",
          "X-Smtp2go-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          fastaccept: false,
          sender: `${message.senderName} <${message.sender}>`,
          to: [message.recipient],
          subject: message.subject,
          html_body: message.html,
          text_body: message.text,
          custom_headers: [
            { header: "Reply-To", value: message.replyTo },
            { header: "X-Posthop-Batch", value: message.batchId },
            { header: "X-Posthop-Recipient", value: message.recipientId },
          ],
        }),
      });
      if (response.status === 429)
        return { kind: "retry", reason: "Provider rate limited request" };
      if (response.status === 408 || response.status >= 500)
        return {
          kind: "unknown",
          reason: "Provider server error; acceptance uncertain",
        };
      if (!response.ok)
        return {
          kind: "rejected",
          reason: `Provider HTTP ${response.status}; review configuration/suppression`,
        };
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "data" in payload) {
        const data = payload.data;
        if (typeof data === "object" && data !== null) {
          if (
            "succeeded" in data &&
            data.succeeded === 1 &&
            "failed" in data &&
            data.failed === 0 &&
            "email_id" in data &&
            typeof data.email_id === "string"
          )
            return { kind: "accepted", providerId: data.email_id };
          if ("succeeded" in data && data.succeeded === 0 && "failed" in data && data.failed === 1)
            return {
              kind: "rejected",
              reason: "Provider declined recipient; review suppression and provider report",
            };
        }
      }
      return {
        kind: "unknown",
        reason: "Unrecognized provider response; acceptance uncertain",
      };
    } catch {
      return {
        kind: "unknown",
        reason: "Connection lost or timed out; acceptance uncertain",
      };
    }
  }
}
