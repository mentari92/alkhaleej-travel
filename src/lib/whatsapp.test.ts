import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("builds a valid wa.me URL with default message template", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "+6281234567890",
      destinationName: "Bali Kintamani",
    });

    expect(url).toContain("https://wa.me/6281234567890");
    expect(url).toContain("text=");
    expect(url).toContain(encodeURIComponent("Bali Kintamani"));
  });

  it("removes non-digit characters from phone number", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "+62 812-3456-7890",
      destinationName: "Raja Ampat",
    });

    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
  });

  it("includes destination name in the encoded message", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "6281234567890",
      destinationName: "Danau Toba",
    });

    const decodedUrl = decodeURIComponent(url);
    expect(decodedUrl).toContain("Danau Toba");
  });

  it("uses default message template when none is provided", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "6281234567890",
      destinationName: "Borobudur",
    });

    const decodedUrl = decodeURIComponent(url);
    expect(decodedUrl).toContain(
      "Halo, saya tertarik dengan paket wisata Borobudur. Bisa info lebih lanjut?"
    );
  });

  it("uses custom message template when provided", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "6281234567890",
      destinationName: "Komodo Island",
      messageTemplate: "I want to book a trip to {destinationName}!",
    });

    const decodedUrl = decodeURIComponent(url);
    expect(decodedUrl).toContain("I want to book a trip to Komodo Island!");
  });

  it("handles phone number with only digits (no cleaning needed)", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "6281234567890",
      destinationName: "Bromo",
    });

    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
  });

  it("properly URL-encodes special characters in the message", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "6281234567890",
      destinationName: "Bali & Lombok",
    });

    // The & should be encoded
    expect(url).toContain(encodeURIComponent("Bali & Lombok"));
    expect(url).not.toContain("&Lombok");
  });
});
