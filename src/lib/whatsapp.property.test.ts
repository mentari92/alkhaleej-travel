import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildWhatsAppUrl } from "./whatsapp";

/**
 * Property 3: WhatsApp URL construction
 * **Validates: Requirements 3.2**
 *
 * For any destination name and WhatsApp number, the generated WhatsApp URL
 * SHALL be a valid `https://wa.me/{number}?text={encoded_message}` URL where
 * the encoded message contains the destination name.
 */
describe("Property 3: WhatsApp URL construction", () => {
  // Generator for phone numbers: strings of digits, possibly with +, spaces, dashes
  const digitStringArb = fc
    .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), { minLength: 1, maxLength: 5 })
    .map((chars) => chars.join(""));

  const phoneNumberArb = fc
    .tuple(
      fc.constantFrom("", "+"),
      fc.array(
        fc.tuple(digitStringArb, fc.constantFrom("", " ", "-")),
        { minLength: 1, maxLength: 5 }
      )
    )
    .map(([prefix, parts]) => prefix + parts.map(([digits, sep]) => digits + sep).join(""))
    .filter((s) => s.replace(/[^0-9]/g, "").length > 0);

  // Generator for non-empty destination names
  const destinationNameArb = fc.string({ minLength: 1, maxLength: 100 });

  it("returned URL starts with https://wa.me/", () => {
    fc.assert(
      fc.property(phoneNumberArb, destinationNameArb, (phoneNumber, destinationName) => {
        const url = buildWhatsAppUrl({ phoneNumber, destinationName });
        expect(url.startsWith("https://wa.me/")).toBe(true);
      })
    );
  });

  it("URL contains only digits between wa.me/ and ?text=", () => {
    fc.assert(
      fc.property(phoneNumberArb, destinationNameArb, (phoneNumber, destinationName) => {
        const url = buildWhatsAppUrl({ phoneNumber, destinationName });
        const afterWaMe = url.slice("https://wa.me/".length);
        const numberPart = afterWaMe.split("?text=")[0];
        expect(numberPart).toMatch(/^\d+$/);
      })
    );
  });

  it("decoded text parameter contains the destination name", () => {
    fc.assert(
      fc.property(phoneNumberArb, destinationNameArb, (phoneNumber, destinationName) => {
        const url = buildWhatsAppUrl({ phoneNumber, destinationName });
        const textParam = url.split("?text=")[1];
        const decodedText = decodeURIComponent(textParam);
        expect(decodedText).toContain(destinationName);
      })
    );
  });

  it("URL is a valid URL (parseable by new URL())", () => {
    fc.assert(
      fc.property(phoneNumberArb, destinationNameArb, (phoneNumber, destinationName) => {
        const url = buildWhatsAppUrl({ phoneNumber, destinationName });
        const parsed = new URL(url);
        expect(parsed.protocol).toBe("https:");
        expect(parsed.hostname).toBe("wa.me");
      })
    );
  });
});
