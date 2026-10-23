import { describe, it, expect, vi } from "vite-plus/test";
import { Smtp2goProvider, type Message } from "../../../packages/smtp2go/src/index";
const message: Message = {
  recipient: "a@example.com",
  sender: "b@example.com",
  senderName: "Business",
  replyTo: "b@example.com",
  subject: "Test",
  html: "<p>Hello</p>",
  text: "Hello",
  batchId: "batch",
  recipientId: "recipient",
};
const transport = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response);
describe("SMTP2GO contract", () => {
  it("uses a single recipient, explicit legacy response contract and correlation headers", async () => {
    const fetcher = transport(
      Response.json({
        data: { succeeded: 1, failed: 0, email_id: "provider-id" },
      }),
    );
    expect(await new Smtp2goProvider("test-secret", fetcher).send(message)).toEqual({
      kind: "accepted",
      providerId: "provider-id",
    });
    const requestBody = fetcher.mock.calls[0][1]?.body;
    if (typeof requestBody !== "string") throw new Error("Expected JSON request body");
    const body = JSON.parse(requestBody);
    expect(body.to).toEqual(["a@example.com"]);
    expect(body.fastaccept).toBe(false);
    expect(body.custom_headers).toContainEqual({
      header: "X-Posthop-Batch",
      value: "batch",
    });
  });
  it.each([429, 400, 408, 500])("classifies HTTP %i conservatively", async (status) => {
    const result = await new Smtp2goProvider("key", transport(new Response("", { status }))).send(
      message,
    );
    expect(result.kind).toBe(status === 429 ? "retry" : status === 400 ? "rejected" : "unknown");
  });
  it("does not confuse HTTP 200 with acceptance", async () => {
    expect(
      (
        await new Smtp2goProvider(
          "key",
          transport(
            Response.json({
              data: { succeeded: 0, failed: 1, failures: ["suppressed"] },
            }),
          ),
        ).send(message)
      ).kind,
    ).toBe("rejected");
    expect(
      (
        await new Smtp2goProvider(
          "key",
          transport(Response.json({ data: { email_id: "changed-contract" } })),
        ).send(message)
      ).kind,
    ).toBe("unknown");
  });
  it("holds timeouts and malformed responses for review", async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect((await new Smtp2goProvider("key", failed).send(message)).kind).toBe("unknown");
    expect(
      (await new Smtp2goProvider("key", transport(new Response("bad JSON"))).send(message)).kind,
    ).toBe("unknown");
  });
});
