import select, { Separator } from '@inquirer/select';
import input from '@inquirer/input';
import { deployTokenContract, showPrivateBalances, showPublicBalances, showAllTestAccounts, mintPublic, mintPrivate } from './interaction_methods.mjs';


const choices = [
  {
    name: 'Show Private Balances',
    value: 'show_private_balances',
    description: 'Show Private Balance Of all Accounts',
  },
  {
    name: 'Show Public Balances',
    value: 'show_public_balances',
    description: 'Show Public Balance Of all Accounts',
  },
  {
    name: 'Deploy token contract',
    value: 'deploy_token',
    description: 'Deploy token contract',
  },
  {
    name: 'Mint Public',
    value: 'mint_public',
  },
  {
    name: 'Mint Private',
    value: 'mint_private',
  },
  {
    name: 'Show Test Accounts',
    value: 'show_test_accounts',
    description: 'Show Test Accounts'
  },
  {
    name: 'Exit',
    value: 'exit',
    disabled: false,
  },
];






async function main() {
  while (1) {
    const answer = await select({
      message: 'What you want to do ?',
      choices,
    });

    switch (answer) {
      case 'show_private_balances':
        await showPrivateBalances();
        break;
      case 'show_public_balances':
        await showPublicBalances();
        break;
      case 'deploy_token':
        await deployTokenContract();
        break;
      case 'show_test_accounts':
        await showAllTestAccounts();
        break;
      case 'mint_public': {
        const address = await input({
          message: "Enter wallet address", validate: (address) => {
            if (!address) return "Please enter valid address";
            return true;
          }
        })
        const amount = await input({
          message: "Enter amount", validate: (amount) => {
            if (isNaN(amount)) return "Please enter valid amount";
            return true;
          }
        })
        await mintPublic(address, amount);
        break;
      }
      case 'mint_private': await mintPrivate();
        break;

      case 'exit': return;
    }
  }
}



main().catch(err => {
  console.error(err)
})