// The entry file of your WebAssembly module.
import {
  Address,
  Context,
  Storage,
  balance,
  call,
  functionExists,
  isAddressEoa,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';
import { IERC20 } from '../interfaces/IERC20';
import { u256 } from 'as-bignum/assembly';

import {
  createUniqueId,
  getVestingInfoKey,
  getClaimedAmountKey,
} from './utils';
import { VestingSessionInfo } from './vesting';
import { SafeMath, SafeMath256 } from '../libraries/SafeMath';

/**
 * This function is meant to be called only one time: when the contract is deployed.
 */
export function constructor(_: StaticArray<u8>): StaticArray<u8> {
  return [];
}

/**
 * @notice Function to transfer remaining Massa coins to a recipient at the end of a call
 * @param balanceInit Initial balance of the SC (transferred coins + balance of the SC)
 * @param balanceFinal Balance of the SC at the end of the call
 * @param sent Number of coins sent to the SC
 * @param to Caller of the function to transfer the remaining coins to
 */
function transferRemaining(
  balanceInit: u64,
  balanceFinal: u64,
  sent: u64,
  to: Address,
): void {
  if (balanceInit >= balanceFinal) {
    // Some operation might spend Massa by creating new storage space
    const spent = SafeMath.sub(balanceInit, balanceFinal);
    assert(spent <= sent, 'Storage__NotEnoughCoinsSent');
    if (spent < sent) {
      // SafeMath not needed as spent is always less than sent
      const remaining: u64 = sent - spent;
      _transferRemaining(to, remaining);
    }
  } else {
    // Some operation might unlock Massa by deleting storage space
    const received = SafeMath.sub(balanceFinal, balanceInit);
    const totalToSend: u64 = SafeMath.add(sent, received);
    _transferRemaining(to, totalToSend);
  }
}

function _transferRemaining(to: Address, value: u64): void {
  if (!isAddressEoa(to.toString()) && functionExists(to, 'receiveCoins'))
    call(to, 'receiveCoins', new Args(), value);
  else transferCoins(to, value);
}

/**
 * @param args - serialized arguments: to_addr, total_amount, start_timestamp,
 *               initial_release_amount, cliff_duration, linear_duration, tag
 * @returns the vesting session ID
 */
export function createVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();
  const sent = Context.transferredCoins();

  // deserialize object
  const vInfo = new VestingSessionInfo(args);

  // get unique session ID
  const sessionId = createUniqueId();

  // save vesting info
  Storage.set(getVestingInfoKey(vInfo.toAddr, sessionId), args);

  // initialize the claimed coin counter
  const initialCounterValue: u256 = u256.Zero;
  Storage.set(
    getClaimedAmountKey(vInfo.toAddr, sessionId),
    new Args().add(initialCounterValue).serialize(),
  );

  // Transfer the tokens to the contract
  new IERC20(vInfo.tokenAddr).transferFrom(
    Context.caller(),
    Context.callee(),
    vInfo.totalAmount,
  );

  // consolidate payment
  transferRemaining(initialSCBalance, balance(), sent, Context.caller());

  // return session ID
  return new Args().add(sessionId).serialize();
}

/**
 * Claim a certain amount of coins from a vesting session.
 * @param args - serialized arguments: session_id, amount
 * @returns
 */
export function claimVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();
  const sent = Context.transferredCoins();

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  const amount = deser.nextU256().expect('Missing amount argument.');
  if (deser.offset !== args.length) {
    throw new Error(
      `Extra data in serialized args (len: ${args.length}) after session id and amount, aborting...`,
    );
  }

  // get current timestamp
  const timestamp = Context.timestamp();

  // get vesting data
  const addr = Context.caller();
  const vestingInfo = new VestingSessionInfo(
    Storage.get(getVestingInfoKey(addr, sessionId)),
  );
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount = new Args(Storage.get(claimedAmountKey))
    .nextU256()
    .unwrap();

  // compute the claimable amount of coins
  const claimableAmount = SafeMath256.sub(
    vestingInfo.getUnlockedAt(timestamp),
    claimedAmount,
  );

  // check amount
  if (amount > claimableAmount) {
    throw new Error('not enough amount unlocked to fulfill claim');
  }

  // update the claimed amount
  Storage.set(
    claimedAmountKey,
    new Args().add(SafeMath256.add(claimedAmount, amount)).serialize(),
  );

  // transfer the coins to the claimer
  new IERC20(vestingInfo.tokenAddr).transfer(addr, amount);

  // consolidate payment
  transferRemaining(initialSCBalance, balance(), sent, Context.caller());

  return [];
}

/**
 * Clear a finished vesting session.
 * @param args - serialized arguments: session_id
 * @returns
 */
export function clearVestingSession(args: StaticArray<u8>): StaticArray<u8> {
  // get the initial balance of the smart contract
  const initialSCBalance = balance();
  const sent = Context.transferredCoins();

  // deserialize arguments
  let deser = new Args(args);
  const sessionId = deser.nextU64().expect('Missing session_id argument.');
  if (deser.offset !== args.length) {
    throw new Error(
      `Extra data in serialized args (len: ${args.length}) after session id, aborting...`,
    );
  }

  // get vesting data
  const addr = Context.caller();
  const vestingInfoKey = getVestingInfoKey(addr, sessionId);
  const vestingInfo = new VestingSessionInfo(Storage.get(vestingInfoKey));
  const claimedAmountKey = getClaimedAmountKey(addr, sessionId);
  const claimedAmount = new Args(Storage.get(claimedAmountKey))
    .nextU256()
    .unwrap();

  // check that everything was claimed
  if (claimedAmount < vestingInfo.totalAmount) {
    throw new Error('cannot delete a session that was not fully claimed');
  }

  // delete entries
  Storage.del(vestingInfoKey);
  Storage.del(claimedAmountKey);

  // consolidate payment
  transferRemaining(initialSCBalance, balance(), sent, Context.caller());

  return [];
}
