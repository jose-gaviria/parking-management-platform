/**
 * Adaptador de facturación electrónica.
 * El proveedor real (DIAN u otro) se integra implementando esta interfaz;
 * mientras tanto opera el proveedor simulado (mock).
 */
export interface InvoiceRequest {
  invoiceNumber: string;
  sessionId: string;
  plate: string;
  total: number;
  subtotal: number;
  tax: number;
  issuedAt: Date;
}

export interface InvoiceResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface BillingProvider {
  readonly name: string;
  createInvoice(request: InvoiceRequest): Promise<InvoiceResult>;
  getInvoiceStatus(providerRef: string): Promise<string>;
  cancelInvoice(providerRef: string, reason: string): Promise<InvoiceResult>;
}
