import { AztecAddress, createPXEClient, Fr, computeMessageSecretHash, ExtendedNote, Note } from "@aztec/aztec.js";
import { readFileSync, writeFileSync } from 'fs'
// import TokenContractJson from '../../target/aztec_contracts-contracts.token.json' assert {type: "json"};
import chalk from "chalk";
import { createAccount, getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from '@aztec/noir-contracts.js'

const { PXE_URL = 'http://localhost:8080' } = process.env;

const pxe = createPXEClient(PXE_URL);


const getFirstAccount = (() => {
  let firstAccount = null;

  return async () => {
    if (firstAccount) {
      return firstAccount;
    }
    firstAccount = await createAccount(pxe)
    return firstAccount
  }
})()

const getSecondAccount = (() => {
  let secondAccount = null;

  return async () => {
    if (secondAccount) {
      return secondAccount;
    }
    secondAccount = await createAccount(pxe)
    return secondAccount
  }
})()



export async function getToken(client) {
  const addresses = JSON.parse(readFileSync('addresses.json'))
  return TokenContract.at(AztecAddress.fromString(addresses.token), client)
}

export async function showPrivateBalances() {
  const accounts = await pxe.getRegisteredAccounts();
  const token = await getToken(pxe)

  for (const account of accounts) {
    const balance = await token.methods.balance_of_private(account.address).simulate()
    console.log("Balance of ", chalk.bgBlue(account.address), ": ", chalk.bgBlue.bold(balance));
  }
}


export async function showPublicBalances() {
  const accounts = await pxe.getRegisteredAccounts();
  const token = await getToken(pxe)

  for (const account of accounts) {
    const balance = await token.methods.balance_of_public(account.address).simulate()
    console.log("Balance of ", chalk.bgBlue(account.address), ": ", chalk.bgBlue.bold(balance));
  }
}

export async function deployTokenContract() {
  let owner = await getFirstAccount();
  const ownerAddress = owner.getCompleteAddress();
  console.log(chalk.green(`Owner wallet address: ${owner.getAddress()}`))
  const token = await TokenContract.deploy(owner, ownerAddress, 'TokenName', 'TKN', 18)
    .send()
    .deployed();

  console.log(`Token deployed at ${token.address.toString()}`);
  const addresses = { token: token.address.toString() };
  writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));
}


export async function showAllTestAccounts() {
  const accounts = await getInitialTestAccountsWallets(pxe);
  console.log(chalk.green.bold("####### Test Accounts ##########"))
  for (const account of accounts) {
    console.log(chalk.bold(account.getAddress() + "\n\n"))
  }
  console.log("############################################")
}

export async function mintPublic(address, amount) {

  let owner = await getFirstAccount();
  const token = await getToken(owner);
  const tx = await token.methods.mint_public(owner.getAddress(), 100n).send();

  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt = await tx.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt.blockNumber)}`));
}

export async function mintPrivate() {
  let owner = await getFirstAccount();
  let recipient = await getSecondAccount();

  const token = await getToken(owner);

  const random = Fr.random();
  const secretHash = await computeMessageSecretHash(random);
  const tx = await token.methods.mint_private(100n, secretHash).send();
  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt = await tx.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt.blockNumber)}`));

  // const storageSlot = new Fr(5);
  // const noteTypeId = new Fr(84114971101151129711410111011678111116101n); // TransparentNote

  const note = new Note([new Fr(100n), secretHash]);
  const extendedNote = new ExtendedNote(
    note,
    recipient.getAddress(),
    token.address,
    TokenContract.storage.pending_shields.slot,
    TokenContract.notes.TransparentNote.id,
    receipt.txHash,
  );
  await recipient.addNote(extendedNote);

  console.log(chalk.bgBlueBright(`Redeeming created note for second wallet: ${recipient.getAddress()} \n`))

  const tx1 = await token.methods.redeem_shield(recipient.getAddress(), 100n, random).send();
  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt1 = await tx1.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt1.blockNumber)}`));
}


export async function shield() {
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = getToken(owner);
}