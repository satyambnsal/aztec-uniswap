// src/deploy.mjs
import { writeFileSync } from 'fs';
import { Contract, loadContractArtifact, createPXEClient } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import TokenContractJson from "../../target/aztec_contracts-contracts.token.json" assert { type: "json" };



main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});