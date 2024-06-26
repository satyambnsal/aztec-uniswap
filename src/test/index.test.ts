import { UniswapV2Contract } from '../artifacts/UniswapV2.js'
import {
  AccountWallet,
  CompleteAddress,
  computeMessageSecretHash,
  Fr,
  PXE,
  waitForPXE,
  createPXEClient,
  getContractInstanceFromDeployParams,
  computeAuthWitMessageHash,
  TxHash,
  Wallet,
  AccountWalletWithPrivateKey,
  sleep,
} from '@aztec/aztec.js'
import { getInitialTestAccountsWallets, createAccount } from '@aztec/accounts/testing'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { addPendingShieldNoteToPXE, publicDeployAccounts } from '../utils.js'

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env
  const pxe = createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}


describe('UniswapV2', () => {
  let pxe: PXE
  let wallets: AccountWallet[] = []
  let token0: TokenContract
  let token1: TokenContract

  let alice: AccountWallet

  let account0: AccountWallet
  let account1: AccountWallet
  let account2: AccountWallet

  const secret0 = Fr.random()
  const secret1 = Fr.random()

  beforeAll(async () => {
    pxe = await setupSandbox()

    wallets = await getInitialTestAccountsWallets(pxe)
    alice = wallets[0]

    account0 = await createAccount(pxe)
    account1 = await createAccount(pxe)
    account2 = await createAccount(pxe)

    try {
      await publicDeployAccounts(alice, [account0, account1, account2])
    } catch (err) {
      console.warn("publicDeployAccounts error:", err)
    }

    token0 = await TokenContract.deploy(
      alice,
      alice.getCompleteAddress(),
      'Token0',
      'TokenSymbol0',
      18
    )
      .send()
      .deployed()
    token1 = await TokenContract.deploy(alice, alice.getCompleteAddress(), 'Token1', 'TokenSymbol1', 18)
      .send()
      .deployed()
  }, 120_000)

  describe("Test public functions", () => {
    let uniswap_contract: UniswapV2Contract

    it('It adds liquidity publicly succeeds', async () => {
      let alice = account0
      let uniswap = await UniswapV2Contract.deploy(alice, token0.address, token1.address)
        .send()
        .deployed()
      let alice_addr = alice.getAddress()

      await token0.methods.mint_public(alice_addr, 100n).send().wait()
      await token1.methods.mint_public(alice_addr, 100n).send().wait()

      const nonce_zero = new Fr(0n)
      let [amount0, amount1] = [10n, 10n]

      /** Public authwit start */
      const action0 = token0
        .withWallet(alice)
        .methods.transfer_public(alice_addr, uniswap.address, amount0, nonce_zero)
      const action1 = token1
        .withWallet(alice)
        .methods.transfer_public(alice_addr, uniswap.address, amount1, nonce_zero)
      await alice.setPublicAuthWit({ caller: uniswap.address, action: action0 }, true).send().wait()
      await alice.setPublicAuthWit({ caller: uniswap.address, action: action1 }, true).send().wait()
      /** Public Authwith end*/


      await uniswap.withWallet(alice).methods.mint(amount0, amount1, 0, 0).send().wait()

      // save wallet for reuse due to it seems publicDepolyAccounts only support 3 accounts at most
      uniswap_contract = uniswap

      expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([amount0, 0n, 0n, 0n])
      expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([amount1, 0n, 0n, 0n])
      expect(await token0.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount0)
      expect(await token1.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount1)
      expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(100n - amount0)
      expect(await token1.methods.balance_of_public(alice_addr).simulate()).toEqual(100n - amount1)


    }, 120_000)

    it('It swaps publicly from token0 to token1 succeeds', async () => {
      let alice = account1
      let uniswap = await UniswapV2Contract.deploy(alice, token0.address, token1.address)
        .send()
        .deployed()
      let alice_addr = alice.getAddress()
      await token0.methods.mint_public(alice_addr, 200n).send().wait()
      await token1.methods.mint_public(alice_addr, 100n).send().wait()

      let nonce = 0;
      // add liquity by Alice first
      /** Public authwit start */
      const action0 = token0
        .withWallet(alice)
        .methods.transfer_public(alice_addr, uniswap.address, 100n, nonce)
      const action1 = token1
        .withWallet(alice)
        .methods.transfer_public(alice_addr, uniswap.address, 100n, nonce)
      await alice.setPublicAuthWit({ caller: uniswap.address, action: action0 }, true).send().wait()
      await alice.setPublicAuthWit({ caller: uniswap.address, action: action1 }, true).send().wait()
      /** Public Authwith end*/
      await uniswap.withWallet(alice).methods.mint(100n, 100n, 0, nonce).send().wait()

      /** Public authwit start */
      // nonce += 1
      let [amount0_in, amount1_out, amount1_in, amount0_out] = [2n, 1n, 0n, 0n]
      const action2 = token0
        .withWallet(alice)
        .methods.transfer_public(alice_addr, uniswap.address, amount0_in, nonce)
      await alice.setPublicAuthWit({ caller: uniswap.address, action: action2 }, true).send().wait()
      /** Public Authwith end*/

      // swap by alice
      await uniswap
        .withWallet(alice)
        .methods.swap(amount0_in, amount1_out, amount1_in, amount0_out, nonce, nonce)
        .send()
        .wait()

      expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([102n, 0n, 0n, 0n])
      expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([99n, 0n, 0n, 0n])
      expect(await token0.methods.balance_of_public(uniswap.address).simulate()).toEqual(102n)
      expect(await token1.methods.balance_of_public(uniswap.address).simulate()).toEqual(99n)
      expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(98n)
      expect(await token1.methods.balance_of_public(alice_addr).simulate()).toEqual(1n)
    }, 120_000)

    it('It removes liqidity publicly succeeds', async () => {
      let alice = account0
      let uniswap = uniswap_contract
      // remove liquidity
      await uniswap
        .withWallet(alice)
        .methods.burn()
        .send()
        .wait()
      expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([0n, 0n, 0n, 0n])
      expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([0n, 0n, 0n, 0n])
      expect(await token0.methods.balance_of_public(uniswap.address).simulate()).toEqual(0n)
      expect(await token1.methods.balance_of_public(uniswap.address).simulate()).toEqual(0n)
      expect(await token0.methods.balance_of_public(alice.getAddress()).simulate()).toEqual(100n)
      expect(await token1.methods.balance_of_public(alice.getAddress()).simulate()).toEqual(100n)
    }, 120_000)
  })

  describe("Test private functions", () => {
    const addLiquidity = async (wallet: AccountWallet, token0: TokenContract, token1: TokenContract, uniswap: UniswapV2Contract, amount0: Fr, amount1: Fr) => {
      const nonce_zero = new Fr(0n)
      /** Public authwit start */
      const action0 = token0
        .withWallet(wallet)
        .methods.transfer_public(wallet.getAddress(), uniswap.address, amount0, nonce_zero)
      const action1 = token1
        .withWallet(wallet)
        .methods.transfer_public(wallet.getAddress(), uniswap.address, amount1, nonce_zero)
      await wallet.setPublicAuthWit({ caller: uniswap.address, action: action0 }, true).send().wait()
      await wallet.setPublicAuthWit({ caller: uniswap.address, action: action1 }, true).send().wait()
      /** Public Authwith end*/

      await uniswap.withWallet(wallet).methods.mint(amount0, amount1, 0, 0).send().wait()
    }

    it('It adds liquidity privately succeeds', async () => {
      let alice = account2
      let uniswap = await UniswapV2Contract.deploy(alice, token0.address, token1.address)
        .send()
        .deployed()
      let alice_addr = alice.getAddress()
      let mint_amount = BigInt(Math.floor(Math.random() * 10000000))
      let secret_hash0 = computeMessageSecretHash(secret0)
      let secret_hash1 = computeMessageSecretHash(secret1)

      const receipt0 = await token0.methods.mint_private(mint_amount, secret_hash0).send().wait();
      const receipt1 = await token1.methods.mint_private(mint_amount, secret_hash1).send().wait();
      let txHash0 = receipt0.txHash;
      let txHash1 = receipt1.txHash;
      await addPendingShieldNoteToPXE(alice, token0, mint_amount, secret_hash0, txHash0);
      await addPendingShieldNoteToPXE(alice, token1, mint_amount, secret_hash1, txHash1);

      await token0.methods.redeem_shield(alice_addr, mint_amount, secret0).send().wait()
      await token1.methods.redeem_shield(alice_addr, mint_amount, secret1).send().wait()
      expect(await token0.methods.balance_of_private(alice_addr).simulate()).toEqual(mint_amount)
      expect(await token1.methods.balance_of_private(alice_addr).simulate()).toEqual(mint_amount)

      let [amount0, amount1] = [10n, 10n]
      /** Private authwit start */
      const action0 = token0
        .withWallet(alice)
        .methods.unshield(alice_addr, uniswap.address, amount0, 0)
      const action1 = token1
        .withWallet(alice)
        .methods.unshield(alice_addr, uniswap.address, amount1, 0)
      const witness0 = await alice.createAuthWit({ caller: uniswap.address, action: action0 })
      const witness1 = await alice.createAuthWit({ caller: uniswap.address, action: action1 })
      await alice.addAuthWitness(witness0)
      await alice.addAuthWitness(witness1)
      /** Private Authwith end*/

      await uniswap.withWallet(alice).methods.mint_private(token0.address, token1.address, amount0, amount1, 0, 0, secret_hash0).send().wait()

      expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([amount0, 0n, 0n, 0n])
      expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([amount1, 0n, 0n, 0n])
      expect(await token0.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount0)
      expect(await token1.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount1)
      expect(await token0.methods.balance_of_private(alice_addr).simulate()).toEqual(mint_amount - amount0)
      expect(await token1.methods.balance_of_private(alice_addr).simulate()).toEqual(mint_amount - amount1)
    }, 120_000)

    it('It swaps privately from token0 to token1 succeeds', async () => {
      let alice = account0
      let token0 = await TokenContract.deploy(alice, alice.getCompleteAddress(), 'Token0Priv', 'TokenSymbol0', 18)
        .send()
        .deployed()
      let token1 = await TokenContract.deploy(alice, alice.getCompleteAddress(), 'Token1Priv', 'TokenSymbol1', 18)
        .send()
        .deployed()
      let uniswap = await UniswapV2Contract.deploy(alice, token0.address, token1.address)
        .send()
        .deployed()

      let alice_addr = alice.getAddress()
      // add liquidity first 
      let amount = 100n
      await token0.methods.mint_public(alice_addr, amount).send().wait()
      await token1.methods.mint_public(alice_addr, amount).send().wait()
      await addLiquidity(alice, token0, token1, uniswap, new Fr(amount), new Fr(amount))

      // mint and redeeem private tokens of token0 to alice
      let secret_hash0 = computeMessageSecretHash(secret0)
      const receipt0 = await token0.methods.mint_private(amount, secret_hash0).send().wait();
      let txHash0 = receipt0.txHash;
      await addPendingShieldNoteToPXE(alice, token0, amount, secret_hash0, txHash0);
      await token0.methods.redeem_shield(alice_addr, amount, secret0).send().wait()

      // swap by alice
      let [amount0_in, amount1_out, amount1_in, amount0_out] = [2n, 1n, 0n, 0n]
      /** Private authwit start */
      const action0 = token0
        .withWallet(alice)
        .methods.unshield(alice_addr, uniswap.address, amount0_in, 0)
      const witness0 = await alice.createAuthWit({ caller: uniswap.address, action: action0 })
      await alice.addAuthWitness(witness0)
      /** Private Authwith end*/
      let secret_hash1 = computeMessageSecretHash(secret1)
      const receipt = await uniswap
        .withWallet(alice)
        .methods.swap_private(token0.address, token1.address, amount0_in, amount1_out, amount1_in, amount0_out, 0, secret_hash1)
        .send()
        .wait()

      expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([amount + amount0_in, 0n, 0n, 0n])
      expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([amount - amount1_out, 0n, 0n, 0n])
      expect(await token0.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount + amount0_in)
      expect(await token1.methods.balance_of_public(uniswap.address).simulate()).toEqual(amount - amount1_out)
      expect(await token0.methods.balance_of_private(alice_addr).simulate()).toEqual(amount - amount0_in)

      await addPendingShieldNoteToPXE(alice, token1, amount1_out, secret_hash1, receipt.txHash)
      await token1.methods.redeem_shield(alice_addr, amount1_out, secret1).send().wait()
      expect(await token1.methods.balance_of_private(alice_addr).simulate()).toEqual(amount1_out)
    }, 200_000)
  })

  describe.skip('Mint-redeem privately flow ', () => {
    let txHash0: TxHash
    let txHash1: TxHash
    let amount = 11n
    let secretHash0 = computeMessageSecretHash(secret0)
    let secretHash1 = computeMessageSecretHash(secret1)

    it('redeem as recipient', async () => {
      const receipt0 = await token0.methods.mint_private(amount, secretHash0).send().wait();
      const receipt1 = await token1.methods.mint_private(amount, secretHash1).send().wait();
      txHash0 = receipt0.txHash;
      txHash1 = receipt1.txHash;
      await addPendingShieldNoteToPXE(alice, token0, amount, secretHash0, txHash0);
      await addPendingShieldNoteToPXE(alice, token1, amount, secretHash1, txHash1);
      token0.methods.redeem_shield(alice.getAddress(), amount, secret0).send().wait();
      token1.methods.redeem_shield(alice.getAddress(), amount, secret1).send().wait();
    });
  });
})
