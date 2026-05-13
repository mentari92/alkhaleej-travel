/**
 * WhatsApp URL builder for destination booking inquiries.
 * Generates wa.me deep links with pre-filled messages.
 */

export interface WhatsAppConfig {
  phoneNumber: string;
  destinationName: string;
  messageTemplate?: string;
}

const DEFAULT_MESSAGE_TEMPLATE =
  "Halo, saya tertarik dengan paket wisata {destinationName}. Bisa info lebih lanjut?";

/**
 * Cleans a phone number by removing all non-digit characters.
 */
function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, "");
}

/**
 * Builds a WhatsApp URL with a pre-filled message containing the destination name.
 *
 * @param config - WhatsApp configuration with phone number, destination name, and optional message template
 * @returns A fully formed https://wa.me URL with encoded message text
 */
export function buildWhatsAppUrl(config: WhatsAppConfig): string {
  const { phoneNumber, destinationName, messageTemplate } = config;

  const cleanedNumber = cleanPhoneNumber(phoneNumber);
  const template = messageTemplate ?? DEFAULT_MESSAGE_TEMPLATE;
  // Use split/join instead of replace to avoid special replacement patterns ($&, $', etc.)
  const message = template.split("{destinationName}").join(destinationName);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanedNumber}?text=${encodedMessage}`;
}
