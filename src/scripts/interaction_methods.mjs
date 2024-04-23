import { AztecAddress, Contract, loadContractArtifact, createPXEClient, Fr, computeMessageSecretHash } from "@aztec/aztec.js";
import { readFileSync } from 'fs'
import TokenContractJson from '../../target/aztec_contracts-contracts.token.json' assert {type: "json"};
import chalk from "chalk";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

const { PXE_URL = 'http://localhost:8080' } = process.env;

const pxe = createPXEClient(PXE_URL);

export async function getToken(client) {
  const addresses = JSON.parse(readFileSync('addresses.json'))
  return Contract.at(AztecAddress.fromString(addresses.token), loadContractArtifact(TokenContractJson), client)
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
  const [ownerWallet] = await getInitialTestAccountsWallets(pxe);
  const ownerAddress = ownerWallet.getCompleteAddress();
  const TokenContractArtifact = loadContractArtifact(TokenContractJson);
  const token = await Contract.deploy(ownerWallet, TokenContractArtifact, [ownerAddress, 'TokenName', 'TKN', 18])
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
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);
  const tx = await token.methods.mint_public(owner.getAddress(), 100n).send();

  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt = await tx.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt.blockNumber)}`));
}

export async function mintPrivate() {
  const [owner, second] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);

  const random = Fr.random();
  const secretHash = await computeMessageSecretHash(random);
  const tx = await token.methods.mint_private(100n, secretHash).send();
  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt = await tx.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt.blockNumber)}`));

  console.log(chalk.bgBlueBright(`Redeeming created note for second wallet: ${second.getAddress()} \n`))

  const tx1 = await token.methods.redeem_shield(second.getAddress(), 100n, random).send();
  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  console.log(chalk.blackBright('Awaiting transaction to be mined'));
  const receipt1 = await tx1.wait();
  console.log(chalk.green(`Transaction has been mined on block ${chalk.bold(receipt1.blockNumber)}`));
}