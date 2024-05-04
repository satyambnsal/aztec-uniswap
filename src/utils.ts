import { type Wallet, BatchCall, Fr, TxHash, ExtendedNote, Note } from '@aztec/aztec.js'
import { SchnorrAccountContractArtifact } from '@aztec/accounts/schnorr'
import { registerContractClass, deployInstance } from '@aztec/aztec.js/deployment'
import { TokenContract } from '@aztec/noir-contracts.js'

export async function publicDeployAccounts(sender: Wallet, accountsToDeploy: Wallet[]) {
  const accountAddressesToDeploy = accountsToDeploy.map((a) => a.getAddress())
  const instances = await Promise.all(
    accountAddressesToDeploy.map((account) => sender.getContractInstance(account))
  )
  const batch = new BatchCall(sender, [
    (await registerContractClass(sender, SchnorrAccountContractArtifact)).request(),
    ...instances.map((instance) => deployInstance(sender, instance!).request()),
  ])
  const result = await batch.send().wait()
  console.log('accounts deployed successfully', result.status, result.txHash)
}


export async function addPendingShieldNoteToPXE(sender: Wallet, asset: TokenContract, amount: bigint, secretHash: Fr, txHash: TxHash) {
  const note = new Note([new Fr(amount), secretHash]);
  const extendedNote = new ExtendedNote(
    note,
    sender.getAddress(),
    asset.address,
    TokenContract.storage.pending_shields.slot,
    TokenContract.notes.TransparentNote.id,
    txHash,
  );
  await sender.addNote(extendedNote);
}