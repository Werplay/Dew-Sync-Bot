import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { configService } from '../config/configuration';
const CryptoJS = require('crypto-js');

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  public async generateToken(address: string, nonce: string): Promise<string> {
    const key = configService.getValue('JWT_TOKEN_SECRET');
    let expiry = configService.getValue('JWT_TOKEN_EXPIRES_IN');
    const time = Date.now() + parseInt(expiry);
    expiry = time.toString();
    const addressNonce = `${address}_${nonce}`;
    const encrypted = await this.encryptWithAES(addressNonce, key);

    let payload = {
      encrypted: encrypted,
      expiry: expiry,
    };

    const token = this.jwtService.sign(payload);
    return token;
  }

  public async decodeToken(token) {
    try {
      const payload = await this.jwtService.verify(token);

      const key = configService.getValue('JWT_TOKEN_SECRET');
      const decrypted = await this.decryptWithAES(payload.encrypted, key);
      const decryptedRes = await decrypted.replace(/\s/g, '').split('_');
      const res = {
        address: decryptedRes[0] || '',
        nonce: decryptedRes[1] || '',
        expiry: payload.expiry || '',
      };

      return res;
    } catch (err) {
      console.log(err);
      throw new HttpException(`Token Invalid`, HttpStatus.UNAUTHORIZED);
    }
  }

  private async encryptWithAES(text, passphrase) {
    return await CryptoJS.AES.encrypt(text, passphrase).toString();
  }

  private async decryptWithAES(ciphertext, passphrase) {
    const bytes = await CryptoJS.AES.decrypt(ciphertext, passphrase);

    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  }
}
