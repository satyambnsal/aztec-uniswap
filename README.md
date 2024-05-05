# How to run
```
# Install the Aztec Toolkit version 0.33.0
aztec-up 0.33.0

# Start the Aztec Sandbox environment
aztec-sandbox

# Clone our repository
git clone https://github.com/satyambnsal/aztec-uniswap

# Navigate into the cloned repository directory
cd aztec-uniswap

# Compile the contract code
yarn compile

# Generate contract artifacts and TypeScript interfaces
yarn codegen

# Execute the test suite
yarn test
```

# Contract Capabilities
The contract has been programmed with two hard-coded tokens and currently offers the following capabilities:
- Supply liquidity privately or publicly: Users can add liquidity to the pool either in a transparent manner or privately.
- Swap privately or publicly: Tokens can be swapped within the pool both publicly and through a private transaction.
- Remove liquidity publicly: Users can remove liquidity from the pool publicly. The functionality for private liquidity removal is under development.
