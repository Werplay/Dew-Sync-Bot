import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AbiItem } from 'web3-utils';
import { ContractInterface, ethers, Wallet } from 'ethers';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

import wallets from 'src/models/wallets';
import { configService } from '../config/configuration';
import { contractAbi } from '../config/abi';

const axios = require('axios');
const _ = require('lodash');
const mongoose = require('mongoose');

const CONTRACT_ADDRESS = configService.getValue('CONTRACT_ADDRESS');
const rpcUrl = configService.getValue('RPC');
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const AddressZero: string = ethers.constants.AddressZero;
const chain = EvmChain.MUMBAI;

interface wallet {
  address: string;
  balance: string;
  blockLastSynced: number;
}

@Injectable()
export class APIservice {
  constructor() {}

  public async getBalance(
    address: string,
    limit: number,
    page: number,
    order: string,
  ) {
    try {
      await this.connectToMongo();
      await this.connectToMoralis();

      const tr = await wallets.count();
      const mongoResult = await wallets
        .find({})
        .select(['-_id'])
        .sort({ blockLastSynced: 'desc' })
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

      return { res: mongoResult, tr: tr };
    } catch (e) {
      console.log(e);
      return HttpStatus.BAD_REQUEST;
    }
  }

  private async refreshTokenHolders() {
    try {
      const walletData: wallet[] = [];

      const currentBlock = await provider.getBlockNumber();
      const toAddresses = await this.getToAddressesFromMoralis();
      await this.fillToAddressWithData(walletData, toAddresses, currentBlock);
      await this.writeDataToMongo(walletData);
      const now = new Date();
      console.log(
        '--> Data refresed at Block : ',
        currentBlock,
        ' and time : ',
        Math.floor(now.getTime() / 1000),
      );
    } catch (e) {
      console.log(e);
    }
  }

  private async writeDataToMongo(walletData: wallet[]) {
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
      const address = CONTRACT_ADDRESS;
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
        CONTRACT_ADDRESS,
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
