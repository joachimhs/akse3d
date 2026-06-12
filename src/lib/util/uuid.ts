// Genererer en uuid-ish streng (samme implementasjon som Skaperiet-host brukte).
export function generateUuidIsh(a?: any): string {
  return a
    ? (0 | (Math.random() * 16)).toString(16)
    : (('' + 1e10) as string).replace(/1|0/g, generateUuidIsh as any);
}
