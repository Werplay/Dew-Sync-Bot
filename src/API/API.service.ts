import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AbiItem } from 'web3-utils';
import { ContractInterface, ethers, Wallet } from 'ethers';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

import wallets from 'src/models/wallets';
import cohorts from 'src/models/cohorts';

import { configService } from '../config/configuration';
import { contractAbi } from '../config/abi';

const axios = require('axios');
const _ = require('lodash');
const mongoose = require('mongoose');

const TOKEN_ADDRESS = configService.getValue('TOKEN_ADDRESS');
const COHORT_ADDRESS = configService.getValue('COHORT_ADDRESS');

const rpcUrl = configService.getValue('RPC');
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
export class APIservice {
  constructor() {}

  public async getCohorts() {
    try {
      await this.connectToMongo();

      const tr = (await cohorts.count()) - 1;
      const mongoResult = await cohorts
        .find({})
        .select(['-_id'])
        .sort({ blockLastSynced: 'asc' })
        .lean();

      const now = new Date();

      if (_.size(mongoResult) == 0) {
        this.refreshCohorts();
      } else if (
        mongoResult[tr]?.blockLastSynced + 10 <
        Math.floor(now.getTime() / 1000)
      ) {
        this.refreshCohorts();
      }
      mongoResult.pop();
      return { res: mongoResult, tr: tr };
    } catch (e) {
      console.log(e);
    }
  }

  public async getBalance(
    address: string,
    limit: number,
    page: number,
    order: string,
  ) {
    try {
      await this.connectToMongo();
      await this.connectToMoralis();

      const tr = (await wallets.count()) - 1;
      const mongoResult = await wallets
        .find({})
        .select(['-_id'])
        .sort({ blockLastSynced: 'asc' })
        .lean();

      const now = new Date();

      if (_.size(mongoResult) == 0) {
        this.refreshTokenHolders();
      } else if (
        mongoResult[0]?.blockLastSynced + 10 <
        Math.floor(now.getTime() / 1000)
      ) {
        this.refreshTokenHolders();
      }

      mongoResult.pop();

      return { res: mongoResult, tr: tr };
    } catch (e) {
      console.log(e);
      return HttpStatus.BAD_REQUEST;
    }
  }

  public async refreshTokenHolders() {
    try {
      const walletData: wallet[] = [];

      const currentBlock = await provider.getBlockNumber();
      let toAddresses = await this.getToAddressesFromMoralis();
      toAddresses = await this.removeDuplicates(toAddresses);
      await this.fillToAddressWithData(walletData, toAddresses, currentBlock);
      await this.writeWalletDataToMongo(walletData);
      const now = new Date();
      console.log(
        '--> Token Holders refresed at Block : ',
        currentBlock,
        ' and time : ',
        Math.floor(now.getTime() / 1000),
      );
    } catch (e) {
      console.log(e);
    }
  }

  public async refreshCohorts() {
    try {
      const cohortData: cohort[] = [];

      const cohortAbi: ContractInterface = [
        {
          inputs: [],
          name: 'totalCohorts',
          outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
          name: 'cohortMap',
          outputs: [
            { internalType: 'string', name: 'name', type: 'string' },
            { internalType: 'address', name: 'admin', type: 'address' },
            { internalType: 'bytes32', name: 'merkleRoot', type: 'bytes32' },
            { internalType: 'bool', name: 'exists', type: 'bool' },
          ],
          stateMutability: 'view',
          type: 'function',
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
            blockLastSynced: Math.floor(now.getTime() / 1000),
            id: -1,
          },
          upsert: true,
        },
      };
      cohortMapPromises.push(zeroSetup);
      await cohorts.bulkWrite(cohortMapPromises);

      // for (let i = 0; i < cohortCount; i++) {
      //   cohortMapPromises.push(contract.cohortMap(i));
      // }

      // const cohortDataToDB: cohort[] = [];
      // const cohortMapResult = await Promise.all(cohortMapPromises).then(
      //   (values) => {
      //     for (let i = 0; i < _.size(values); i++) {
      //       const cohortData: cohort = {
      //         name: values[i].name,
      //         admin: values[i].admin,
      //         merkleRoot: values[i].merkleRoot,
      //         exists: values[i].exists,
      //         index: i,
      //         blockLastSynced: 0,
      //       };
      //       cohortDataToDB.push();
      //     }
      //   },
      // );
      // console.log('--> cohortMapResult : ', cohortMapResult);

      console.log(
        '--> Cohorts refresed at time : ',
        Math.floor(now.getTime() / 1000),
      );
    } catch (e) {
      console.log(e);
    }
  }

  private async writeWalletDataToMongo(walletData: wallet[]) {
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
            balance: '0',
            blockLastSynced: Math.floor(now.getTime() / 1000),
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
  private async getToAddressesFromMoralis() {
    try {
      const address = TOKEN_ADDRESS;
      const response = await Moralis.EvmApi.token.getTokenTransfers({
        address,
        chain,
      });

      // console.log(response.toJSON());

      let toAddresses: string[] = [];
      for (let i = 0; i < _.size(response?.result); i++) {
        const toAddress = response?.result[i]?.toAddress?.checksum;
        if (toAddress != AddressZero) {
          toAddresses.push(toAddress);
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
    currentBlock: number,
  ) {
    try {
      for (let i = 0; i < _.size(toAddresses); i++) {
        const temp: wallet = {
          address: toAddresses[i],
          blockLastSynced: currentBlock,
          balance: await this.getBalanceOfAddress(toAddresses[i]),
        };
        walletData.push(temp);
      }
    } catch (e) {
      console.log(e);
    }
  }

  private async getBalanceOfAddress(address: string): Promise<string> {
    try {
      const contract = new ethers.Contract(
        TOKEN_ADDRESS,
        contractAbi,
        provider,
      );

      const result = await contract.balanceOf(address);

      return ethers.utils.formatEther(result).toString();
    } catch (error: any) {
      //console.log('Contract does not have owner function');
      return '0';
    }
  }

  private async connectToMoralis() {
    try {
      if (Moralis.Core.isStarted == false) {
        await Moralis.start({
          apiKey: configService.getValue('MORALIS_KEY'),
        });

        console.log('-> Moralis Reconnected');
      }
    } catch (e) {
      console.log('--> connectToMoralis error', e);
    }
  }

  private async connectToMongo() {
    mongoose.set('strictQuery', true);
    mongoose
      .connect(configService.getValue('MONGO_URL'), {
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
