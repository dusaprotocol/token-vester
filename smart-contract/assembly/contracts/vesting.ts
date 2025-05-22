import { Address } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';

import { u256 } from 'as-bignum/assembly';
import { SafeMath, SafeMath256 } from '../libraries/SafeMath';

const MAX_TAG_LEN: i32 = 127;

/**
 * VestingSchedule structure
 */
export class VestingSessionInfo {
  toAddr: Address;
  tokenAddr: Address;
  totalAmount: u256;
  startTimestamp: u64;
  initialReleaseAmount: u256;
  cliffDuration: u64;
  linearDuration: u64;
  tag: string;

  constructor(bytes: StaticArray<u8>) {
    const argsObj = new Args(bytes);
    this.toAddr = argsObj
      .nextSerializable<Address>()
      .expect('Missing to_addr argument.');
    this.tokenAddr = argsObj
      .nextSerializable<Address>()
      .expect('Missing token_Addr argument.');
    this.totalAmount = argsObj
      .nextU256()
      .expect('Missing total_amount argument.');
    this.startTimestamp = argsObj
      .nextU64()
      .expect('Missing start_timestamp argument.');
    this.initialReleaseAmount = argsObj
      .nextU256()
      .expect('Missing initial_release_amount argument.');
    this.cliffDuration = argsObj
      .nextU64()
      .expect('Missing cliff_duration argument.');
    this.linearDuration = argsObj
      .nextU64()
      .expect('Missing linear_duration argument.');
    this.tag = argsObj.nextString().expect('Missing tag argument.');
    if (argsObj.offset !== bytes.length) {
      throw new Error('Extra data in buffer.');
    }

    if (this.tag.length > MAX_TAG_LEN) {
      throw new Error('Tag is too long');
    }

    // check that the initial release amount is not greater than the total amount
    if (this.initialReleaseAmount > this.totalAmount) {
      throw new Error(
        'initial_release_amount cannot be greater than total_amount.',
      );
    }
  }

  /**
   * @param currentTimestamp - current timestamp
   * @returns the amount that has been unlocked at the given timestamp
   */
  public getUnlockedAt(timestamp: u64): u256 {
    // before activation
    if (timestamp < this.startTimestamp) {
      return u256.Zero;
    }

    // during cliff
    if (timestamp - this.startTimestamp < this.cliffDuration) {
      return this.initialReleaseAmount;
    }

    // time after cliff end
    const timeAfterCliffEnd = SafeMath.sub(
      SafeMath.sub(timestamp, this.startTimestamp),
      this.cliffDuration,
    );

    // after linear release
    if (timeAfterCliffEnd >= this.linearDuration) {
      // full release
      return this.totalAmount;
    }

    // total amount to be released linearly
    const linearAmount = SafeMath256.sub(
      this.totalAmount,
      this.initialReleaseAmount,
    );

    // amount released linearly so far

    const linearReleased = SafeMath256.div(
      SafeMath256.mul(linearAmount, u256.from(timeAfterCliffEnd)),
      u256.from(this.linearDuration),
    );

    // total released amount until timestamp
    return SafeMath256.add(this.initialReleaseAmount, linearReleased);
  }
}
