/**
 * Acceso de demostración. Solo existe si el despliegue define DEMO_USERNAME y
 * DEMO_PASSWORD: una instalación real no las define y no tiene usuario demo.
 * Las credenciales son públicas a propósito (se muestran en el inicio de sesión).
 */
export function demoAccess(): { username: string; password: string } | null {
  const username = process.env.DEMO_USERNAME?.toLowerCase().trim();
  const password = process.env.DEMO_PASSWORD;
  return username && password ? { username, password } : null;
}
