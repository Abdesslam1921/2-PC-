/**
 * Single source of truth for Algerian mobile numbers, shared by the COD
 * checkout (`orders.createCod`), the manual order form and the public
 * abandoned-cart endpoint, so one rule applies everywhere.
 *
 * Accepted shapes are normalised before validation: spaces, dashes, dots and
 * parentheses are stripped, and a `+213` / `00213` / `213` country prefix (or a
 * bare 9-digit `5/6/7…` number) becomes the local `0X…` form.
 */
export const ALGERIAN_MOBILE_PATTERN = /^0[567][0-9]{8}$/;

export function normalizeAlgerianMobile(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim().replace(/[\s\-().]/g, "");
  if (!value || !/^[+\d]+$/.test(value)) return null;
  if (value.startsWith("+")) value = value.slice(1);
  if (value.startsWith("00")) value = value.slice(2);
  if (value.startsWith("213")) value = value.slice(3);
  // A bare national number arrives as 9 digits starting with 5/6/7.
  if (/^[567][0-9]{8}$/.test(value)) value = `0${value}`;
  return ALGERIAN_MOBILE_PATTERN.test(value) ? value : null;
}
