import {
    Account,
    Args,
    Web3Provider,
  } from '@massalabs/massa-web3';
import { assert } from './utils';
import {VestingSessionInfo} from "./serializables/vesting";
  
  const account = await Account.fromEnv();
  console.log(account.address.toString());
  const provider = Web3Provider.mainnet(account);

  const sc_addr = process.env.SC_ADDR;
  if (!sc_addr) {
    throw new Error('Missing SC_ADDR in .env file');
  }

  // get all the vesting sessions of the user
let addrInfo = await provider.client.getAddressInfo(sc_addr);
let allKeys = addrInfo[0].candidate_datastore_keys;

 // console.log("allKeys:", allKeys);

/*
for(let i=0; i<allKeys.length; i++) {

}
*/

let allSessionKeys = allKeys.filter((k) => {
    return k[0] === 0x02;
 });
 
 console.log("Found", allSessionKeys.length, "session keys");
 console.log("Details:");



 for(let i=0; i<allSessionKeys.length; i++) {
    let session_key = allSessionKeys[i];

    let args = new Args(session_key);
    let prefix = args.nextU8();
    let addr = args.nextString();
    let sessionId = args.nextU64();

    console.log("Key", i, `: prefix: ${prefix}, addr: ${addr}, sessionId: ${sessionId}`);

    // TODO: fetch Vesting session info

    let vestingSessions = await provider.client.getDatastoreEntries([{
        address: sc_addr,
        key: new Uint8Array(session_key)
    }]);

    // console.log(vestingSessions);
    assert(vestingSessions.length !== 0, "Could not find vesting sessions");
    assert(vestingSessions.length === 1, "Found more than 1 vesting sessions");

    let vestingSessionBytes = vestingSessions[0] ? vestingSessions[0] : new Uint8Array();

    let vestingSession = new Args(vestingSessionBytes).nextSerializable(VestingSessionInfo);

    // console.log("  - ", vestingSession);
    assert(vestingSession.toAddr === addr, "Vesting session info addr and key are !=");
    console.log("  totalAmount:", (vestingSession.totalAmount).toString(), "MAS", `(${vestingSession.totalAmount} nanoMAS)`);
    console.log("  initialReleaseAmount:", (vestingSession.initialReleaseAmount).toString(), "MAS", `(${vestingSession.initialReleaseAmount} nanoMAS)`);
    let start = new Date(Number(vestingSession.startTimestamp)).toUTCString();
    console.log("  startTimestamp (UTC)", start);

    let claimedAmountKey = new Args().addU8(3).addString(addr).addU64(sessionId).serialize();

    let claimedAmounts = await provider.client.getDatastoreEntries([{
        address: sc_addr,
        key: new Uint8Array(claimedAmountKey)
    }]);

    // 0 claimed amount is valid
    assert(claimedAmounts.length === 1, "Found more than 1 claimed amount");

    let claimedAmountBytes = claimedAmounts[0] ? claimedAmounts[0] : new Uint8Array();
    let claimedAmount = new Args(claimedAmountBytes).nextU64();

    console.log("  - Claimed amount:", claimedAmount.toString(), "MAS");
}
