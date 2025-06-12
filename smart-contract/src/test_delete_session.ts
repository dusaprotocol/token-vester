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
let vesting_session_id = BigInt(0);

console.log("Deleting Vesting session:", vesting_session_id);

let serialized_arg = new Args();
serialized_arg.addU64(vesting_session_id);
let serialized = serialized_arg.serialize();

// Estimation
/*
let gas_cost = await getDynamicCosts(
    client as Client,
    sc_addr,
    "clearVestingSession",
    serialized
);
console.log("Estimated gas_cost", gas_cost);
*/
// End Estimation

// Note: we use a fixed storage cost in order to minimize code
let gas_cost = BigInt(2550000);
let storage_cost_fees = Mas.fromMas(0n);
let op_fee = BigInt(1);


const sc = new SmartContract(provider, sc_addr);

let op = await sc.call("clearVestingSession", serialized,
    { maxGas: gas_cost,
    coins: BigInt(storage_cost_fees),
    fee: op_fee
    });

    console.log("Deleting op:", op.id);

  const events = await provider.getEvents({
    smartContractAddress: sc_addr,
  });
  for (const event of events) {
    console.log('Event message:', event.data);
  }



