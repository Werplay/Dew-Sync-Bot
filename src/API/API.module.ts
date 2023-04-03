import { Module } from '@nestjs/common';
import { APIcontroller } from './API.controller';
import { APIservice } from './API.service';
import { EthHelper } from '../services/eth.helper';
import { SigningService } from '../services/signing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [APIcontroller],
  providers: [APIservice, SigningService, EthHelper],
})
export class APImodule {}
