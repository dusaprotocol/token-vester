import {
    Address,
    call,
    Context,
    createSC,
    fileToByteArray,
    generateEvent,
    transferCoins,
  } from '@massalabs/massa-as-sdk';
  import { u256 } from 'as-bignum/assembly/integer/u256';
  import { Args } from '@massalabs/as-types';
import { IERC20 } from '../interfaces/IERC20';

  const ONE_COIN = u64(10**9)
  export function constructor(_: StaticArray<u8>): void {
    main(_);
  }
  
  export function main(_: StaticArray<u8>): void {
    const bytecode: StaticArray<u8> = fileToByteArray('build/main.wasm');
    const vesting = createSC(bytecode);
    transferCoins(vesting, 5 * ONE_COIN);
    call(vesting, 'constructor', new Args(), 0);


    const addr1 = new Address(
        'AU1CEgenUUUagyvdyqpn6QKDRQwrXSDZzaxaV46c9eL3L5q5Vi5o',
      );
      const tokenAddr = new IERC20(new Address(
        'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ',
      ));
  
      let totalAmount: u256 = u256.from(42_000_000);
      let initialReleaseAmount: u256 = u256.from(22_000_000);
      let startTimestamp: u64 = Context.timestamp();
      let cliffDuration: u64 = 0;
      let linearDuration: u64 = 100_000;
      let tag = '1';
      let sessionArgs = serializeVestingInfo(
        addr1,
        tokenAddr._origin,
        totalAmount,
        startTimestamp,
        initialReleaseAmount,
        cliffDuration,
        linearDuration,
        tag,
      );

    tokenAddr.increaseAllowance(vesting, totalAmount);

    const id = new Args(call(vesting, 'createVestingSession', sessionArgs, ONE_COIN)).nextU64().unwrap();
  
    generateEvent(vesting.toString() + ' ' + id.toString());
  
  }
  

  function serializeVestingInfo(
    toAddr: Address,
    tokenAddr: Address,
    totalAmount: u256,
    startTimestamp: u64,
    initialReleaseAmount: u256,
    cliffDuration: u64,
    linearDuration: u64,
    tag: String,
  ): Args {
    return new Args()
      .add(toAddr)
      .add(tokenAddr)
      .add(totalAmount)
      .add(startTimestamp)
      .add(initialReleaseAmount)
      .add(cliffDuration)
      .add(linearDuration)
      .add(tag);
  }