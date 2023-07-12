import { Module } from "@nestjs/common";
import { BOTcontroller } from "./BOT.controller";
import { BOTservice } from "./BOT.service";

@Module({
  imports: [],
  controllers: [BOTcontroller],
  providers: [BOTservice],
})
export class BOTmodule {}
