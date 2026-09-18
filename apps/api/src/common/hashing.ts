/**
 * Costo de bcrypt para contraseñas y PIN.
 *
 * 12 es el mínimo recomendado por OWASP para bcrypt. Nota de rendimiento:
 * `bcryptjs` es JavaScript puro, así que a costo 12 cada verificación tarda
 * cientos de milisegundos. Es aceptable aquí — un inicio de sesión por turno y
 * unas pocas autorizaciones por hora — pero si el volumen crece, cambiar a
 * `bcrypt` nativo o argon2id antes que a bajar el costo.
 */
export const BCRYPT_COST = 12;

/** Longitud mínima de contraseña (OWASP: ≥ 8, sin reglas de composición). */
export const MIN_PASSWORD_LENGTH = 8;

/** Longitud mínima del PIN de autorización. */
export const MIN_PIN_LENGTH = 4;
