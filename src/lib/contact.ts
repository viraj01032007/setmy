/** One place for SetMyStay's public contact details. */
export const CONTACT_PHONE_DISPLAY = "+91 79771 69550";
export const CONTACT_PHONE_E164 = "+917977169550";
export const WHATSAPP_NUMBER = "917977169550"; // wa.me format: country code + number, no "+" or spaces
export const CONTACT_EMAIL = "setmystay02@gmail.com";

export const whatsappLink = (message = "Hello, I have a question about SetMyStay.") =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
