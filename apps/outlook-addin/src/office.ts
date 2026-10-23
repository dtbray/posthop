export interface Draft {
  subject: string;
  html: string;
  text: string;
}
function result<T>(resolve: (v: T) => void, reject: (e: Error) => void) {
  return (r: Office.AsyncResult<T>) =>
    r.status === Office.AsyncResultStatus.Succeeded
      ? resolve(r.value)
      : reject(new Error(r.error.message));
}
export async function readDraft(): Promise<Draft> {
  const item = Office.context.mailbox.item as Office.MessageCompose;
  if (!item || typeof item.subject === "string")
    throw new Error("Open this add-in in a message compose window.");
  const [subject, html, text] = await Promise.all([
    new Promise<string>((yes, no) => item.subject.getAsync(result(yes, no))),
    new Promise<string>((yes, no) => item.body.getAsync(Office.CoercionType.Html, result(yes, no))),
    new Promise<string>((yes, no) => item.body.getAsync(Office.CoercionType.Text, result(yes, no))),
  ]);
  const attachments = await new Promise<Office.AttachmentDetailsCompose[]>((yes, no) =>
    item.getAttachmentsAsync(result(yes, no)),
  );
  if (attachments.length || /(?:src\s*=\s*["']?cid:)/i.test(html))
    throw new Error(
      "Attachments and inline images are not supported. Remove them before preparing this message.",
    );
  return { subject, html, text };
}
export function properties(): Promise<Office.CustomProperties> {
  return new Promise((yes, no) =>
    Office.context.mailbox.item!.loadCustomPropertiesAsync(result(yes, no)),
  );
}
// Called only by the explicit preparation action, never by read/initialization.
export async function prepareDraft(): Promise<{ draft: Draft; key: string }> {
  const draft = await readDraft();
  const props = await properties();
  const saved: unknown = props.get("posthopSubmissionKey");
  const key = typeof saved === "string" ? saved : crypto.randomUUID();
  if (!saved) {
    props.set("posthopSubmissionKey", key);
    await new Promise<void>((yes, no) => props.saveAsync(result(yes, no)));
  }
  return { draft, key };
}
