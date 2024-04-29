import { UniswapV2ContractArtifact, UniswapV2Contract } from "../artifacts/UniswapV2.js"
import { AccountWallet, CompleteAddress, ContractDeployer, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets, createAccount } from "@aztec/accounts/testing"
import { TokenContract } from '@aztec/noir-contracts.js/Token';

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

describe("UniswapV2", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];

    let uniswap:UniswapV2Contract
    let token0: TokenContract;
    let token1: TokenContract;

    let alice: AccountWallet;
    let bob: AccountWallet;


    beforeAll(async () => {
        pxe = await setupSandbox();

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress())
        alice = wallets[0];
        bob = wallets[1];
        token0 = await TokenContract.deploy(alice, alice.getCompleteAddress(), 'Token0', 'TokenSymbol0', 18)
        .send()
        .deployed();
        token1 = await TokenContract.deploy(bob, bob.getCompleteAddress(), 'Token1', 'TokenSymbol1', 18)
        .send()
        .deployed();

        uniswap = await UniswapV2Contract.deploy(wallets[0], token0.address, token1.address)  
        .send()
        .deployed();

        const recipientAddr = uniswap.address;
        let alice_addr = alice.getAddress();
        await token0.methods.mint_public(alice_addr, new Fr(100n)).send().wait();
        await token0.methods.mint_public(recipientAddr, new Fr(100n)).send().wait();
    }, 120_000)

    // it("It increase UniswapV2 funds on mint", async () => {
    //     const recipientAddr = uniswap.address;
    //     expect(await token0.methods.balance_of_public(recipientAddr).simulate()).toEqual(0n);
    //     let receipt = await token0.methods.mint_public(recipientAddr, 100n).send().wait();
    //     expect(await token0.methods.balance_of_public(recipientAddr).simulate()).toEqual(100n);
    // }, 5_000)

    it("It transfers fund to UniswapV2 contract on transaction", async () => {
        const recipientAddr = uniswap.address;
        let alice_addr = alice.getAddress();
        await token0.methods.mint_public(recipientAddr, 100n).send().wait();

        expect(await token0.methods.balance_of_public(recipientAddr).simulate()).toEqual(100n);
        let reciept = await uniswap.methods.tranfer_token0(10n, 0n).send().wait();
        expect(await token0.methods.balance_of_public(recipientAddr).simulate()).toEqual(90n);
        expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(10n);
    }, 15_000)

    it("It add liquidity", async() => {
        const recipientAddr = uniswap.address;
        let alice_addr = alice.getAddress();

        console.log("token0 address:", token0.address);
        console.log("alice_addr address:", alice_addr);
        console.log("uniswap address===============>:", recipientAddr);

        await token0.methods.mint_public(alice_addr, 100n).send().wait();
        await token1.methods.mint_public(alice_addr, 100n).send().wait();
        let resp = await uniswap.withWallet(alice).methods.mint(10, 10, 0, 1).send().wait();
        console.log(resp);

        // expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(90n);
        // expect(await token1.methods.balance_of_public(alice_addr).simulate()).toEqual(90n);
        // expect(await token0.methods.balance_of_public(recipientAddr).simulate()).toEqual(10n);
        // expect(await token1.methods.balance_of_public(recipientAddr).simulate()).toEqual(10n);

    }, 15_000)

    it.only("It transfer token from user to UNI contract", async () => {
        const recipientAddr = uniswap.address;
        let alice_addr = alice.getAddress();

        console.log("token0 address:", token0.address);
        console.log("alice_addr address:", alice_addr);
        console.log("uniswap address===============>:", recipientAddr);
        // expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(100n);
        // await token0.methods.transfer_public(alice_addr, recipientAddr, 10n, 0).send().wait();
        // expect(await token0.methods.balance_of_public(alice_addr).simulate()).toEqual(90n);

        let resp = await uniswap.withWallet(alice).methods.tranfer_token0(new Fr(10n), 0).send().wait();
        console.log(resp);
    })
});