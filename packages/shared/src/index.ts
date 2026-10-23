import Papa from "papaparse";
import { z } from "zod";

export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export function normalizeEmail(value: string): string | null {
  const parsed = emailSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}
export const submissionSchema = z
  .object({
    idempotencyKey: z.uuid(),
    senderId: z.literal("primary"),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(998)
      .refine((v) => !/[\r\n]/.test(v)),
    html: z.string().min(1).max(200_000),
    text: z.string().min(1).max(200_000),
    // Phase 1 deliberately restricts delivery to one recipient.
    recipients: z
      .array(
        z.object({
          email: emailSchema,
          firstName: z.string().max(100).optional(),
          lastName: z.string().max(100).optional(),
        }),
      )
      .length(1),
  })
  .strict();
export type Submission = z.infer<typeof submissionSchema>;
export type RecipientState =
  | "queued"
  | "attempting"
  | "deferred"
  | "provider_accepted"
  | "unknown"
  | "rejected";
export interface BatchStatus {
  id: string;
  subject: string;
  created_at: string;
  state: string;
  recipient: {
    email: string;
    state: RecipientState;
    attempts: number;
    provider_id: string | null;
    last_error: string | null;
  };
  mock: boolean;
}
export interface RecipientSource {
  kind: "csv" | "manual" | "square";
  recipients: { email: string; firstName?: string; lastName?: string }[];
}
export function parseRecipients(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(
    csv.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/[ -]+/g, "_"),
    },
  );
  const errors = parsed.errors.map(
    (e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`,
  );
  const fields = parsed.meta.fields ?? [];
  // Square Customer Directory exports use Email Address / Given Name / Family Name.
  const emailKey = ["email", "email_address"].find((k) => fields.includes(k));
  if (!emailKey) errors.push("Missing email or Email Address column.");
  const seen = new Set<string>();
  const recipients: RecipientSource["recipients"] = [];
  const duplicates: number[] = [];
  parsed.data.forEach((row, i) => {
    if (!emailKey) return;
    const email = normalizeEmail(row[emailKey] ?? "");
    if (!email) {
      errors.push(`Row ${i + 2}: invalid or missing email.`);
      return;
    }
    if (seen.has(email)) {
      duplicates.push(i + 2);
      return;
    }
    seen.add(email);
    recipients.push({
      email,
      firstName: row.first_name ?? row.given_name,
      lastName: row.last_name ?? row.family_name,
    });
  });
  return { recipients, errors, duplicates };
}
