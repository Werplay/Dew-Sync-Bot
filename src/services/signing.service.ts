import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { EthHelper } from './eth.helper';
import signin from '../models/signin';
import { configService } from '../config/configuration';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';

@Injectable()
export class SigningService {
  constructor(
    private readonly ethHelper: EthHelper,
    private authService: AuthService,
  ) {}
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean | Promise<boolean> | Observable<boolean>> {
    try {
      const request = context.switchToHttp().getRequest();
      let res = request.headers.authorization;
      res = res.split(' ')[1];
      return await this.validateToken(res);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Token Invalid`, HttpStatus.UNAUTHORIZED);
    }
  }

  async generateRequest(address: String, provider: String) {
    try {
      const nonce = this.ethHelper.generateNonce();
      const signingRequest = {
        address: address,
        nonce: nonce,
        walletProvider: provider,
        status: 'requested',
        tokenUsed: 0,
      };

      await signin.create(signingRequest);
      return nonce;
    } catch (e) {
      console.error('generateRequest failed', e);
      throw new HttpException(
        `generateRequest failed`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getSigningRequestByNonce(nonce: String) {
    try {
      const res = await signin
        .findOne({ nonce: nonce, status: 'requested' })
        .select('address')
        .lean();

      if (res != null && res != undefined) {
        await signin
          .findOneAndUpdate({ nonce: nonce }, { status: 'used' })
          .select([])
          .lean();
        return res;
      } else {
        throw new HttpException(`Nonce Used Already`, HttpStatus.UNAUTHORIZED);
      }
    } catch (e) {
      console.error('getSigningRequestByNonce failed ', e);
      throw new HttpException(`Nonce Used Already`, HttpStatus.UNAUTHORIZED);
    }
  }

  public async validateToken(token: any) {
    let res = await this.authService.decodeToken(token);

    const tokenIssueTime =
      parseInt(res.expiry) -
      parseInt(configService.getValue('JWT_TOKEN_EXPIRES_IN'));

    if (
      Date.now() <
      tokenIssueTime + parseInt(configService.getValue('ESSENTIAL_TOKEN_LIFE'))
    ) {
      return true;
    } else {
      throw new HttpException(`Token Expired`, HttpStatus.UNAUTHORIZED);
    }
  }

  public async getAddressFromToken(token: any) {
    try {
      const res = await this.authService.decodeToken(token);
      return res.address;
    } catch (e) {
      console.error('getAddressFromToken Error ', e);
      throw new HttpException(
        'getAddressFromToken Error ',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
