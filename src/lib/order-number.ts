// Crockford-style alphabet without look-alike characters (0/O, 1/I/L, U),
// so the number is easy to read out over the phone.
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORDER_NUMBER_PATTERN = /^BS-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

/** randomInt(max) must return a uniformly random integer in [0, max). */
export function generateOrderNumber(randomInt: (max: number) => number): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  return `BS-${s}`;
}

export function normalizeOrderNumberInput(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.startsWith("BS") ? `BS-${s.slice(2)}` : `BS-${s}`;
}
