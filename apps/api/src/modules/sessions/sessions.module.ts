import { Module } from '@nestjs/common';
import { TariffsModule } from '../tariffs/tariffs.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TariffsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
