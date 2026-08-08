import { Injectable } from '@nestjs/common';
import { BillingProvider, InvoiceRequest, InvoiceResult } from './billing-provider.interface';

/** Proveedor simulado: acepta todo. Solo para desarrollo y demostración. */
@Injectable()
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock';

  async createInvoice(request: InvoiceRequest): Promise<InvoiceResult> {
    return { ok: true, providerRef: `MOCK-${request.invoiceNumber}` };
  }

  async getInvoiceStatus(): Promise<string> {
    return 'ACCEPTED';
  }

  async cancelInvoice(providerRef: string): Promise<InvoiceResult> {
    return { ok: true, providerRef };
  }
}
