import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { isValidAddress, bufferToHex } from 'ethereumjs-util';
import { recoverPersonalSignature, personalSign } from '@metamask/eth-sig-util';

@Injectable()
export class EthHelper {
  constructor() {}

  public async signMessage(
    message: string,
    privateKey: Buffer,
  ): Promise<string> {
    return personalSign({ data: message, privateKey });
  }

  async isValidMessageHash(
    signature: string,
    address: string,
    nonce: string,
  ): Promise<boolean> {
    let message = this.getArbitraryCode(address, nonce);
    const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));

    const recoveredAddress = recoverPersonalSignature({
      data: msgBufferHex,
      signature,
    });

    return recoveredAddress.toLowerCase() === address.toLowerCase();
  }

  isValidAddress(hexAddress: string): boolean {
    return isValidAddress(hexAddress);
  }

  generateNonce(): string {
    return uuidv4();
  }

  getArbitraryCode(address: string, nonce: string): string {
    return `Welcome to Dew!
    This is a signin request and 
    this request will not trigger a blockchain transaction or cost any gas fees.
    
    Wallet address:
    ${address}
    
    Nonce:
    ${nonce}`;
  }
}
