import {
  Account,
  Args,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';

const account = await Account.fromEnv();
console.log(account.address.toString());
const provider = Web3Provider.mainnet(account);

const sc_addr = process.env.SC_ADDR;
if (!sc_addr) {
  throw new Error('Missing SC_ADDR in .env file');
}

// let sc_addr = "AS1VtQNYyHacsykHtCVP9CeYPB4oE4QmPvetfqqn9hb1PMLeNbmN";
// let sc_addr = "AS12tx6aLtn6GWVB9i9NRzD5GEkUezbKQYsxvdmUaKqVgNgo6sZ2f";

console.log('Creating a Vesting session...');

// let timedelta = 60 * 60 * 1000; // 1 hour
let timedelta = 0;

// Placeholder function for send logic
let serialized_arg = new Args();
let sendToAddr = 'AU1x5PzpZCyf93HAMhYV4VpmgMr8PNrAs1QDbEXVMGmeHvzrZqjY';
let sendTotalAmount = BigInt(198);
let sendStartTimestamp = BigInt(Date.now() + timedelta);
let sendInitialReleaseAmount = BigInt(50);
let sendCliffDuration = BigInt(1000);
let sendLinearDuration = BigInt(1000);
let sendTag = 'testw3 t8';

serialized_arg.addString(sendToAddr);
serialized_arg.addU64(sendTotalAmount);
serialized_arg.addU64(sendStartTimestamp);
serialized_arg.addU64(sendInitialReleaseAmount);
serialized_arg.addU64(sendCliffDuration);
serialized_arg.addU64(sendLinearDuration);
serialized_arg.addString(sendTag);
let serialized = serialized_arg.serialize();

// Estimate gas cost & storage cost
// waiting for ReadSC + coins
/*
let gas_cost = await getDynamicCosts(
    client,
    sc_addr,
    "createVestingSession",
    serialized
);

console.log("e gas_cost", gas_cost);
*/
// console.log("e storage_cost", storage_cost);

// End Estimate

// Note: we use a fixed storage cost in order to minimize code

let gas_cost = BigInt(2550000);
let storage_cost_fees = Mas.fromMas(2n);
let op_fee = BigInt(1);

const sc = new SmartContract(provider, sc_addr);

let op = await sc.call('createVestingSession', serialized, {
  maxGas: gas_cost,
  coins: sendTotalAmount + BigInt(storage_cost_fees),
  fee: op_fee,
});

console.log('Done creating a Vesting session:', op.id);

const events = await provider.getEvents({
  smartContractAddress: sc_addr,
});
for (const event of events) {
  console.log('Event message:', event.data);
}
