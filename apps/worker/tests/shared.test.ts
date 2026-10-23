import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  parseRecipients,
  submissionSchema,
} from "../../../packages/shared/src/index";
describe("recipient import", () => {
  it("handles BOM, quoted names, CRLF, blanks and normalized duplicates", () => {
    const result = parseRecipients(
      '\uFEFFemail,first_name,last_name\r\n Jane@Example.com ,"Jane, J.",Doe\r\n\r\njane@example.com,Jane,Doe\r\nbad,John,Doe',
    );
    expect(result.recipients).toEqual([
      { email: "jane@example.com", firstName: "Jane, J.", lastName: "Doe" },
    ]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
  it("accepts common Square Customer Directory headers", () => {
    expect(
      parseRecipients(
        "Email Address,Given Name,Family Name\r\na@example.com,A,B",
      ).recipients[0],
    ).toEqual({ email: "a@example.com", firstName: "A", lastName: "B" });
  });
  it("reports malformed CSV, missing columns and missing addresses", () => {
    expect(parseRecipients("name\nJane").errors).toContain(
      "Missing email or Email Address column.",
    );
    expect(
      parseRecipients('email,first_name\n"a@example.com,Jane').errors.length,
    ).toBeGreaterThan(0);
    expect(parseRecipients("email,first_name\n,Jane").errors).toHaveLength(1);
  });
  it("does not collapse plus addressing or accept header injection", () => {
    expect(normalizeEmail("a+event@example.com")).toBe("a+event@example.com");
    expect(normalizeEmail("a@example.com\r\nBcc: x@example.com")).toBeNull();
    expect(submissionSchema.safeParse({}).success).toBe(false);
  });
});
