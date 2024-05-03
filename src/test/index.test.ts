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
} from '@aztec/aztec.js'
import { getInitialTestAccountsWallets, createAccount } from '@aztec/accounts/testing'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { publicDeployAccounts } from '../utils.js'

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env
  const pxe = createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}

describe('UniswapV2', () => {
  let pxe: PXE
  let wallets: AccountWallet[] = []
  let accounts: CompleteAddress[] = []

  let uniswap: UniswapV2Contract
  let token0: TokenContract
  let token1: TokenContract

  let alice: AccountWallet
  let bob: AccountWallet

  const secret = Fr.random()
  let secret_hash: Fr

  beforeAll(async () => {
    pxe = await setupSandbox()

    wallets = await getInitialTestAccountsWallets(pxe)

    accounts = wallets.map((w) => w.getCompleteAddress())
    alice = wallets[0]
    bob = wallets[1]
    // await publicDeployAccounts(alice, [alice, bob])

    token0 = await TokenContract.deploy(
      alice,
      alice.getCompleteAddress(),
      'Token0',
      'TokenSymbol0',
      18
    )
      .send()
      .deployed()
    token1 = await TokenContract.deploy(bob, bob.getCompleteAddress(), 'Token1', 'TokenSymbol1', 18)
      .send()
      .deployed()

    uniswap = await UniswapV2Contract.deploy(alice, token0.address, token1.address)
      .send()
      .deployed()

    secret_hash = computeMessageSecretHash(secret)
  }, 120_000)

  it.only('It add liquidity publicly', async () => {
    let alice_addr = alice.getAddress()

    await token0.methods.mint_public(alice_addr, 100n).send().wait()
    await token1.methods.mint_public(alice_addr, 100n).send().wait()

    // print alice balance for token 0 and token
    // const token0_balance_alice = await token0.methods.balance_of_public(alice_addr).simulate()
    // const token1_balance_alice = await token1.methods.balance_of_public(alice_addr).simulate()
    // console.log({ token0_balance_alice, token1_balance_alice })
    const nonce0 = Fr.random()
    const nonce1 = Fr.random()

    /** Public authwit start */
    // const transferMessageHash1 = computeAuthWitMessageHash(
    //   uniswap.address,
    //   alice.getChainId(),
    //   alice.getVersion(),
    //   token0.methods.transfer_public(alice_addr, uniswap.address, 10n, nonce).request()
    // )

    // const transferMessageHash2 = computeAuthWitMessageHash(
    //   uniswap.address,
    //   alice.getChainId(),
    //   alice.getVersion(),
    //   token1.methods.transfer_public(alice_addr, uniswap.address, 10n, nonce).request()
    // )

    // await alice.setPublicAuthWit(transferMessageHash1, true).send().wait()
    // await alice.setPublicAuthWit(transferMessageHash2, true).send().wait()

    /** Public Authwith end*/
    await uniswap.withWallet(alice).methods.mint(10n, 10n, 0, 0).send().wait()

    // expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(90n);
    // expect(await token1.methods.balance_of_public(alice_addr).simulate()).toEqual(90n);

    expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([10n, 0n, 0n, 0n])
    expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([10n, 0n, 0n, 0n])
  }, 120_000)

  it('It swaps publicly from token0 to token1 throws due to lack of liquity', async () => {
    let alice_addr = alice.getAddress()
    let uni_addr = uniswap.address

    await token0.methods.mint_public(alice_addr, 100n).send().wait()
    await token1.methods.mint_public(uni_addr, 100n).send().wait()

    let [amount0_in, amount1_out, amount1_in, amount0_out] = [1n, 2n, 0n, 0n]
    await expect(
      uniswap
        .withWallet(alice)
        .methods.swap(amount0_in, amount1_out, amount1_in, amount0_out, 0)
        .send()
        .wait()
    ).rejects.toThrow('Liquidity is not enough!')
  }, 120_000)

  it('It swaps publicly from token0 to token1 succeeds', async () => {
    let alice_addr = alice.getAddress()
    await token0.methods.mint_public(alice_addr, 100n).send().wait()
    await token1.methods.mint_public(alice_addr, 100n).send().wait()

    // add liquity by Alice first
    await uniswap.withWallet(alice).methods.mint(100n, 100n, 0, 0).send().wait()
    expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([100n, 0n, 0n, 0n])
    expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([100n, 0n, 0n, 0n])
    // swap by Bob
    let [amount0_in, amount1_out, amount1_in, amount0_out] = [2n, 1n, 0n, 0n]
    await uniswap
      .withWallet(bob)
      .methods.swap(amount0_in, amount1_out, amount1_in, amount0_out, 0)
      .send()
      .wait()
    expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([102n, 0n, 0n, 0n])
    expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([99n, 0n, 0n, 0n])
  }, 120_000)

  it('It swaps privately from token0 to token1 succeeds', async () => {
    let alice_addr = alice.getAddress()
    await token0.methods.mint_public(alice_addr, 100n).send().wait()
    await token1.methods.mint_public(alice_addr, 100n).send().wait()

    // add liquity by Alice first
    await uniswap.withWallet(alice).methods.mint(100n, 100n, 0, 0).send().wait()
    expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([100n, 0n, 0n, 0n])
    expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([100n, 0n, 0n, 0n])
    // swap by Bob
    let [amount0_in, amount1_out, amount1_in, amount0_out] = [2n, 1n, 0n, 0n]
    await uniswap
      .withWallet(bob)
      .methods.swap_private(amount0_in, amount1_out, amount1_in, amount0_out, 0, secret_hash)
      .send()
      .wait()
    expect(await uniswap.methods.get_reserves_0().simulate()).toEqual([102n, 0n, 0n, 0n])
    expect(await uniswap.methods.get_reserves_1().simulate()).toEqual([99n, 0n, 0n, 0n])
    // redeem sheild successfully
    // await token1.methods.redeem_shield(bob.getAddress(), 1n, secret).send().wait();
  }, 30_000)

  // it.only("It transfer token from user to UNI contract", async () => {
  //     const recipientAddr = uniswap.address;
  //     let alice_addr = alice.getAddress();
  //     await token0.methods.mint_public(alice_addr, new Fr(100n)).send().wait();
  //     await token0.methods.mint_public(recipientAddr, new Fr(100n)).send().wait();

  //     await uniswap.withWallet(alice).methods.test_tranfer_token0(new Fr(10n), 0).send().wait();
  // })
})
