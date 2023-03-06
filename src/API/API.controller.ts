import {
  Controller,
  Get,
  UploadedFile,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  Post,
  UseGuards,
} from '@nestjs/common';
import { APIservice } from './API.service';
import { configService } from '../config/configuration';
import { ethers } from 'ethers';
import { AuthService } from '../auth/auth.service';
import { EthHelper } from '../services/eth.helper';
import { SigningService } from '../services/signing.service';

const EthUtil = require('ethereumjs-util');
const Web3 = require('web3');
const Web3Utils = require('web3-utils');
const _ = require('lodash');

@Controller('')
export class APIcontroller {
  constructor(
    private readonly apiService: APIservice,
    private readonly ethHelper: EthHelper,
    private readonly authService: AuthService,
    private readonly signinService: SigningService,
  ) {
    // this.test();
  }

  private async test() {
    const web3 = new Web3();
    const wallet = '0xF3c42432e52dfd5b765dd428E3F31F10194dAa16';
    const privateKey =
      '0x8e7678e94a927fbc550c7605856b1e7e928152d2572cbc34ce8f2bc161b968da';

    const signinParams = {
      address: wallet,
      provider: 'metamask',
    };

    const signInRes = await this.signin(signinParams);
    console.log(signInRes);

    const signature = web3.eth.accounts.sign(
      signInRes.arbitaryCode,
      privateKey,
    );

    const verifySignatureParams = {
      signature: signature.signature,
      nonce: signInRes.nonce,
    };
    console.log(verifySignatureParams);

    const token = await this.verifySignature(verifySignatureParams);
    console.log(token);

    await this.signinService.validateToken(token.token);
  }

  @Post('signin')
  async signin(@Body() params: any) {
    console.log('--- signin Triggered ---');
    try {
      params.address = await Web3Utils.toChecksumAddress(params.address);
      const res = await this.apiService.signin(params.provider, params.address);

      return res;
    } catch (e) {
      throw new HttpException(`${e}`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('verify-signature')
  async verifySignature(@Body() params: any) {
    console.log('--- verifySignature Triggered ---');
    try {
      if (params.signature != undefined && params.nonce != undefined) {
        const res = await this.apiService.verifySignature(
          params.signature,
          params.nonce,
        );
        return res;
      }
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(SigningService)
  @Post('balance/:address?:limit?:page?:order?')
  async getBalance(@Query() query: any) {
    let res = { tr: 0, data: null };

    try {
      if (query.address != null)
        query.address = ethers.utils.getAddress(query.address);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Address`, HttpStatus.BAD_REQUEST);
    }
    try {
      const limit = query.limit ? parseInt(query.limit) : 10;
      const page = query.page ? parseInt(query.page) : 0;
      const order = query.order ? query.order : 'desc';

      const temp = await this.apiService.getBalance(
        query.address,
        limit,
        page,
        order,
      );
      res['data'] = temp['res'];
      res['tr'] = temp['tr'];

      return res;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(SigningService)
  @Get('stats')
  async getStats() {
    return this.apiService.getStats();
  }

  @UseGuards(SigningService)
  @Post('cohorts')
  async getCohorts() {
    let res = { tr: 0, data: null };

    try {
      const temp = await this.apiService.getCohorts();
      res['data'] = temp['res'];
      res['tr'] = temp['tr'];

      return res;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Invalid Params`, HttpStatus.BAD_REQUEST);
    }
  }
}
