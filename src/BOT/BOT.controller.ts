import { BOTservice } from "./BOT.service";
import { configService } from "../config/configuration";

const EthUtil = require("ethereumjs-util");
const Web3 = require("web3");
const Web3Utils = require("web3-utils");
const _ = require("lodash");

const REFRESH_DELAY = configService.getValue("REFRESH_DELAY");
export class BOTcontroller {
  constructor(private readonly botService: BOTservice) {
    this.BOT_START();
  }

  private async BOT_START() {
    console.log("*** BOT STARTED ***");
    while (true) {
      try {
        await this.botService.makeConnections();
        await this.botService.start();
        await this.botService.delay(REFRESH_DELAY);
      } catch (e) {
        console.log("---> BOT_START ERROR : ", e);
      }
    }
  }
}
