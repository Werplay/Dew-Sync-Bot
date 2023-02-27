import { Module } from '@nestjs/common';
import { APIcontroller } from './API.controller';
import { APIservice } from './API.service';

@Module({
  imports: [],
  controllers: [APIcontroller],
  providers: [APIservice],
})
export class APImodule {}
