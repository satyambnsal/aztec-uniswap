import { type Wallet, BatchCall } from '@aztec/aztec.js'
import { SchnorrAccountContractArtifact } from '@aztec/accounts/schnorr'
import { registerContractClass, deployInstance } from '@aztec/aztec.js/deployment'

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