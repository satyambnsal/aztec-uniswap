// src/deploy.mjs
import { writeFileSync } from 'fs';
import { Contract, loadContractArtifact, createPXEClient } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import TokenContractJson from "../../target/aztec_contracts-contracts.token.json" assert { type: "json" };


const { PXE_URL = 'http://localhost:8080' } = process.env;

async function main() {
  const pxe = createPXEClient(PXE_URL);
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

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});