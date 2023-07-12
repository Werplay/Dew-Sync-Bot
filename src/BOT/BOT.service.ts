import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { ContractInterface, ethers, Wallet } from "ethers";
import Moralis from "moralis";
import { EvmChain } from "@moralisweb3/common-evm-utils";

import wallets from "src/models/wallets";
import cohorts from "src/models/cohorts";
import users from "src/models/users";

import { configService } from "../config/configuration";
import { contractAbi } from "../config/abi";
import { cohortAbi } from "../config/cohort.abi";
import { add } from "lodash";

const axios = require("axios");
const _ = require("lodash");
const crypto = require("crypto");

const mongoose = require("mongoose");
const Web3Utils = require("web3-utils");

const TOKEN_ADDRESS = configService.getValue("TOKEN_ADDRESS");
const COHORT_ADDRESS = configService.getValue("COHORT_ADDRESS");

const rpcUrl = configService.getValue("RPC");
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const AddressZero: string = ethers.constants.AddressZero;
const chain = EvmChain.MUMBAI;

interface wallet {
  address: string;
  balance: string;
  blockLastSynced: number;
}

interface cohort {
  name: string;
  index: number;
  admin: string;
  blockLastSynced: number;
  merkleRoot: string;
  exists: boolean;
}

@Injectable()
export class BOTservice {
  constructor() {}

  public async makeConnections() {
    await this.connectToMongo();
    await this.connectToMoralis();
  }

  public async start() {
    try {
      const _blockLastSynced = (
        await wallets
          .findOne({ address: AddressZero })
          .select(["blockLastSynced", "-_id"])
          .lean()
      )["blockLastSynced"];

      const _currentBlock = await provider.getBlockNumber();

      this.refreshTokenHolders(_blockLastSynced, _currentBlock);
      this.refreshCohorts(_currentBlock);
    } catch (e) {}
  }

  public async refreshTokenHolders(
    _blockLastSynced: number,
    _currentBlock: number
  ) {
    try {
      const walletData: wallet[] = [];
      let toAddresses = await this.getToAddressesFromMoralis(_blockLastSynced);
      toAddresses = await this.removeDuplicates(toAddresses);
      await this.fillToAddressWithData(walletData, toAddresses, _currentBlock);
      await this.writeWalletDataToMongo(walletData, _currentBlock);
      const now = new Date();
      console.log(
        "--> Token Holders refresed at Block : ",
        _currentBlock,
        " and time : ",
        Math.floor(now.getTime() / 1000)
      );
    } catch (e) {
      console.log(e);
    }
  }

  public async refreshCohorts(currentBlock: number) {
    try {
      const cohortData: cohort[] = [];

      const cohortAbi: ContractInterface = [
        {
          inputs: [],
          name: "totalCohorts",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          name: "cohortMap",
          outputs: [
            { internalType: "string", name: "name", type: "string" },
            { internalType: "address", name: "admin", type: "address" },
            { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
            { internalType: "bool", name: "exists", type: "bool" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ];

      const contract = new ethers.Contract(COHORT_ADDRESS, cohortAbi, provider);

      const cohortCount = (await contract.totalCohorts()).toNumber();
      const cohortMapPromises = [];
      for (let i = 0; i < cohortCount; i++) {
        const value = await contract.cohortMap(i);
        const query = {
          updateOne: {
            filter: { id: i },
            update: {
              name: value.name,
              admin: value.admin,
              merkleRoot: value.merkleRoot,
              exists: value.exists,
              blockLastSynced: 0,
              id: i,
            },
            upsert: true,
          },
        };
        cohortMapPromises.push(query);
      }
      const now = new Date();

      const zeroSetup = {
        updateOne: {
          filter: { id: -1 },
          update: {
            name: AddressZero,
            admin: AddressZero,
            merkleRoot: AddressZero,
            exists: true,
            blockLastSynced: currentBlock,
            id: -1,
          },
          upsert: true,
        },
      };
      cohortMapPromises.push(zeroSetup);
      await cohorts.bulkWrite(cohortMapPromises);

      console.log(
        "--> Cohorts refresed at time : ",
        Math.floor(now.getTime() / 1000)
      );
    } catch (e) {
      console.log(e);
    }
  }

  private async writeWalletDataToMongo(
    walletData: wallet[],
    currentBlock: number
  ) {
    try {
      let quries = [];
      for (let i = 0; i < _.size(walletData); i++) {
        const query = {
          updateOne: {
            filter: { address: walletData[i].address },
            update: {
              balance: walletData[i].balance,
              blockLastSynced: walletData[i].blockLastSynced,
            },
            upsert: true,
          },
        };
        quries.push(query);
      }

      const now = new Date();
      const query = {
        updateOne: {
          filter: { address: AddressZero },
          update: {
            balance: "0",
            blockLastSynced: currentBlock,
          },
          upsert: true,
        },
      };
      quries.push(query);

      await wallets.bulkWrite(quries);
    } catch (e) {
      console.log(e);
    }
  }
  private async getToAddressesFromMoralis(_blockLastSynced: number) {
    try {
      let toAddresses: string[] = [];
      const address = TOKEN_ADDRESS;

      const topic =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      const abi = {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "from",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "Transfer",
        type: "event",
      };

      const response = await Moralis.EvmApi.events.getContractEvents({
        address,
        chain,
        topic,
        fromBlock: _blockLastSynced,
        abi,
      });
      const resJSON = response.toJSON().result;
      for (let i = 0; i < _.size(resJSON); i++) {
        if (resJSON[i]?.data?.from != AddressZero) {
          const value = resJSON[i]?.data?.from;
          toAddresses.push(ethers.utils.getAddress(value));
        }
        if (resJSON[i]?.data?.to != AddressZero) {
          const value = resJSON[i]?.data?.to;
          toAddresses.push(ethers.utils.getAddress(value));
        }
      }

      return toAddresses;
    } catch (e) {
      console.log(e);
    }
  }

  private async removeDuplicates<T>(array: T[]): Promise<T[]> {
    const map = new Map();
    for (const item of array) {
      map.set(item, item);
    }
    return Array.from(map.values());
  }

  private async fillToAddressWithData(
    walletData: wallet[],
    toAddresses: string[],
    currentBlock: number
  ) {
    try {
      const promisList = [];
      const onePromise = async (i: number) => {
        const temp: wallet = {
          address: toAddresses[i],
          blockLastSynced: currentBlock,
          balance: await this.getBalanceOfAddress(toAddresses[i]),
        };
        walletData.push(temp);
      };

      for (let i = 0; i < _.size(toAddresses); i++) {
        promisList.push(onePromise(i));
      }

      await Promise.all(promisList);
    } catch (e) {
      console.log(e);
    }
  }

  private async getBalanceOfAddress(address: string): Promise<string> {
    try {
      const contract = new ethers.Contract(
        TOKEN_ADDRESS,
        contractAbi,
        provider
      );

      const result = await contract.balanceOf(address);

      return ethers.utils.formatEther(result).toString();
    } catch (error: any) {
      //console.log('Contract does not have owner function');
      return "0";
    }
  }

  private async connectToMoralis() {
    try {
      if (Moralis.Core.isStarted == false) {
        await Moralis.start({
          apiKey: configService.getValue("MORALIS_KEY"),
        });

        // console.log("-> Moralis Reconnected");
      }
    } catch (e) {
      console.log("--> connectToMoralis error", e);
    }
  }

  private async connectToMongo() {
    mongoose.set("strictQuery", true);
    mongoose
      .connect(configService.getValue("MONGO_URL"), {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => {})
      .catch((err) => {
        console.log(`MONGO CONNECTION ERROR!`);
        console.log(err);
      });
  }
  public async delay(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
