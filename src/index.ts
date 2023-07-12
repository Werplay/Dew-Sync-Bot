import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { configService } from "./config/configuration";

async function bootstrap(runLocal: Boolean) {
  if (runLocal) {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe());
    console.log("*** BOT STARTED ***");
  }
}
bootstrap(true);
