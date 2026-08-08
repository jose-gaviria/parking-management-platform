import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService, BILLING_PROVIDER } from './billing.service';
import { MockBillingProvider } from './mock-billing.provider';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    // Cambiar aquí (o por variable de entorno) cuando exista el proveedor real
    { provide: BILLING_PROVIDER, useClass: MockBillingProvider },
  ],
  exports: [BillingService],
})
export class BillingModule {}
