mod interfaces;
mod types;

contract UniswapV2 {
    use dep::aztec::prelude::{
        AztecAddress, FunctionSelector, NoteHeader, NoteInterface, NoteGetterOptions, PrivateContext,
        Map, PublicMutable
    };
    use dep::aztec::context::{Context, gas::GasOpts};
    use crate::interfaces::Token;
    use dep::authwit::auth::{IS_VALID_SELECTOR, compute_outer_authwit_hash};
    // use dep::token::Token;
    use crate::types::{transparent_note::TransparentNote, token_note::{TokenNote, TOKEN_NOTE_LEN}, balances_map::BalancesMap};

    #[aztec(storage)]
    struct Storage {
        token0: PublicMutable<AztecAddress>,
        token1: PublicMutable<AztecAddress>,
        reserve0: PublicMutable<U128>,
        reserve1: PublicMutable<U128>,
        total_supply: PublicMutable<U128>,
        liquidity_balance_public: Map<AztecAddress, PublicMutable<U128>>,
        liquidity_balance_private: BalancesMap<TokenNote>
    }

    #[aztec(public)]
    #[aztec(initializer)] // annotation to mark function as a constructor
    fn constructor(_token0: AztecAddress, _token1: AztecAddress) {
        storage.token0.write(_token0);
        storage.token1.write(_token1);
    }

    #[aztec(public)]  // add liquidity 
    fn mint(amount0: Field, amount1: Field, nonce0: Field, nonce1: Field) -> Field { // returns liquity
        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();

        let this_addr = context.this_address();
        let msg_sender = context.msg_sender();

        let amount0 = U128::from_integer(amount0);
        let amount1 = U128::from_integer(amount1);

        assert(
            (amount0 > U128::from_integer(0)) & (amount1 > U128::from_integer(0)), "Should add liquidity tokens first!"
        );
        // transfer liquity in
        Token::at(token0_addr).delegate_transfer_public(
            &mut context,
            msg_sender,
            this_addr,
            // amount0.to_integer(),
            0,
            nonce0
        );

        Token::at(token1_addr).delegate_transfer_public(
            &mut context,
            msg_sender,
            this_addr,
            // amount1.to_integer(),
            0,
            nonce1
        );

        let total_supply = storage.total_supply.read();
        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let mut liquidity = U128::from_integer(0);
        if (total_supply == U128::from_integer(0)) {
            liquidity = amount0 * amount1;
        } else { // TODO, the result should be sqrted
            let t1 = amount0 * total_supply / reserve0;
            let t2 = amount1 * total_supply / reserve1;
            if t1 < t2 {
                liquidity = t1;
            } else {
                liquidity = t2;
            }
        }

        // mint to user
        storage.total_supply.write(total_supply + liquidity);
        storage.liquidity_balance_public.at(msg_sender).write(liquidity);

        // update reserve
        storage.reserve0.write(reserve0 + amount0);
        storage.reserve1.write(reserve1 + amount1);
    }

    #[aztec(private)]
    fn mint_private(amount0: Field, amount1: Field, nonce0: Field, nonce1: Field) -> Field {
        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();

        let this_addr = context.this_address();
        let msg_sender = context.msg_sender();

        let amount0 = U128::from_integer(amount0);
        let amount1 = U128::from_integer(amount1);

        assert(
            (amount0 > U128::from_integer(0)) & (amount1 > U128::from_integer(0)), "Should add liquidity tokens first!"
        );

        /*
        How do I transfer token privately from user's private balance
        */

        Token::at(token0_addr).unshield(
            &mut context,
            msg_sender,
            this_addr,
            amount0.to_integer(),
            nonce0
        );
        Token::at(token1_addr).unshield(
            &mut context,
            msg_sender,
            this_addr,
            amount1.to_integer(),
            nonce0
        );

        let total_supply = storage.total_supply.read();
        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let mut liquidity = U128::from_integer(0);
        if (total_supply == U128::from_integer(0)) {
            liquidity = amount0 * amount1;
        } else { // TODO, the result should be sqrted
            let t1 = amount0 * total_supply / reserve0;
            let t2 = amount1 * total_supply / reserve1;
            if t1 < t2 {
                liquidity = t1;
            } else {
                liquidity = t2;
            }
        }

        // mint to user
        storage.total_supply.write(total_supply + liquidity);
        storage.liquidity_balance_private.add(msg_sender, U128::from_integer(liquidity));

        // update reserve
        storage.reserve0.write(reserve0 + amount0);
        storage.reserve1.write(reserve1 + amount1);
    }

    #[aztec(public)]
    fn burn() {
        let msg_sender = context.msg_sender();
        let zero = U128::from_integer(0);
        let liquidity = storage.liquidity_balance_public.at(msg_sender).read();
        assert(liquidity > U128::from_integer(0), "Insufficient liquidity for sender");

        let total_supply = storage.total_supply.read();
        assert(liquidity < total_supply, "Liquidity should be less than total supply");

        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let amount0 = liquidity * reserve0 / total_supply;
        let amount1 = liquidity * reserve1 / total_supply;
        assert(amount0 < reserve0, "Insufficient token0 reserve");
        assert(amount1 < reserve1, "Insufficient token1 reserve");
        storage.liquidity_balance_public.at(msg_sender).write(zero);
        storage.total_supply.write(total_supply - liquidity);
        storage.reserve0.write(reserve0 - amount0);
        storage.reserve1.write(reserve1 - amount1);

        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();
        let this_addr = context.this_address();

        Token::at(token0_addr).transfer_public(&mut context, this_addr, msg_sender, amount0.to_integer(), 0);
        Token::at(token1_addr).transfer_public(&mut context, this_addr, msg_sender, amount1.to_integer(), 0);
    }

    #[aztec(private)]
    fn burn_private() {
        let msg_sender = context.msg_sender();
        let zero = U128::from_integer(0);
        let msg_sender = context.msg_sender();
        let liquidity = storage.liquidity_balance_private.balance_of(msg_sender);
        assert(liquidity > U128::from_integer(0), "Insufficient liquidity for sender");

        let total_supply = storage.total_supply.read();
        assert(liquidity < total_supply, "Liquidity should be less than total supply");

        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let amount0 = liquidity * reserve0 / total_supply;
        let amount1 = liquidity * reserve1 / total_supply;
        assert(amount0 < reserve0, "Insufficient token0 reserve");
        assert(amount1 < reserve1, "Insufficient token1 reserve");
        storage.liquidity_balance_private.sub(msg_sender, liquidity);
        storage.total_supply.write(total_supply - liquidity);
        storage.reserve0.write(reserve0 - amount0);
        storage.reserve1.write(reserve1 - amount1);

        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();
        let this_addr = context.this_address();

        //TODO: Figure out a way to transfer tokens from uniswap public balance to user's private balance without needing a secret.
        // Token::at(token0_addr).transfer_public(&mut context, this_addr, msg_sender, amount0.to_integer(), 0);
        // Token::at(token1_addr).transfer_public(&mut context, this_addr, msg_sender, amount1.to_integer(), 0);
    }

    #[aztec(public)]  // add liquidity 
    fn swap(
        amount0_in: Field,
        amount1_out: Field,
        amount1_in: Field,
        amount0_out: Field,
        nonce: Field
    ) {
        let amount0_in = U128::from_integer(amount0_in);
        let amount1_in = U128::from_integer(amount1_in);
        let amount0_out = U128::from_integer(amount0_out);
        let amount1_out = U128::from_integer(amount1_out);
        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let zero = U128::from_integer(0);
        assert(
            ((amount0_in > zero) & (amount1_out > zero)) | ((amount1_in > zero) & (amount0_out > zero)), "UniswapV2: INSUFFICIENT_INPUT/OUPUT_AMOUNT"
        );
        assert((amount0_out < reserve0) & (amount1_out < reserve1), "Liquidity is not enough!");

        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();
        let this_addr = context.this_address();
        let msg_sender = context.msg_sender();

        let (token_in, token_out, amount_in, amount_out, balance0_new, balance1_new) = if amount0_in > zero {
            let balance0_new = reserve0 + amount0_in;
            let balance1_new = reserve1 - amount1_out;
            (token0_addr, token1_addr, amount0_in, amount1_out, balance0_new, balance1_new)
        } else {
            let balance0_new = reserve0 - amount0_out;
            let balance1_new = reserve1 + amount1_in;
            (token1_addr, token0_addr, amount1_in, amount0_out, balance0_new, balance1_new)
        };

        // transfer token from user to UNI contract address
        Token::at(token_in).delegate_transfer_public(
            &mut context,
            msg_sender,
            this_addr,
            0, // TODO: fix subtract with underflow 'hi == high' erro when amount0 is larger than 0
            // amount_in.to_integer(),
            nonce
        );
        // transfer swapped token from UNI contract address to user
        Token::at(token_out).transfer_public(
            &mut context,
            this_addr,
            msg_sender,
            0,
            // amount_out.to_integer(), // TODO: fix subtract with underflow 'hi == high' erro when amount0 is larger than 0
            0
        );

        // check constant product K
        assert(balance0_new * balance1_new >= reserve0 * reserve1, "K check failed");
        // update reserves
        storage.reserve0.write(balance0_new);
        storage.reserve1.write(balance1_new);
    }

    #[aztec(private)]
    fn swap_private(
        amount0_in: Field,
        amount0_out: Field,
        amount1_in: Field,
        amount1_out: Field,
        nonce: Field,
        secret_hash: Field
    ) {
        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();

        let from = context.msg_sender();
        let this_addr = context.this_address();

        if amount0_out != 0 {
            Token::at(token0_addr).shield(&mut context, this_addr, amount0_out, secret_hash, 0);
        } else {
            Token::at(token1_addr).shield(&mut context, this_addr, amount1_out, secret_hash, 0);
        }

        // transfer tokens in
        if amount0_in != 0 {
            Token::at(token0_addr).unshield(&mut context, from, this_addr, amount0_in, nonce);
        } else {
            Token::at(token1_addr).unshield(&mut context, from, this_addr, amount1_in, nonce);
        }

        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("_update(Field,Field,Field,Field)"),
            [amount0_in, amount0_out, amount1_in, amount1_out]
        );
    }

    #[aztec(public)]
    #[aztec(internal)]
    fn _update(amount0_in: Field, amount0_out: Field, amount1_in: Field, amount1_out: Field) {
        let amount0_in = U128::from_integer(amount0_in);
        let amount1_in = U128::from_integer(amount1_in);
        let amount0_out = U128::from_integer(amount0_out);
        let amount1_out = U128::from_integer(amount1_out);
        let zero = U128::from_integer(0);

        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();

        assert(
            ((amount0_in > zero) & (amount1_out > zero)) | ((amount1_in > zero) & (amount0_out > zero)), "UniswapV2: INSUFFICIENT_INPUT/OUPUT_AMOUNT"
        );
        assert((amount0_out < reserve0) & (amount1_out < reserve1), "Liquidity is not enough!");

        let reserve0_aft = reserve0 + amount0_in - amount0_out;
        let reserve1_aft = reserve1 + amount1_in - amount1_out;

        // constant product K check
        let k_pre = reserve0.to_field().mul(reserve1.to_field());
        let k_aft = reserve0_aft.to_field().mul(reserve1_aft.to_field());
        assert(k_pre.lt(k_aft) | (k_pre == k_aft), "K check failed");

        // update reserves
        storage.reserve0.write(reserve0_aft);
        storage.reserve1.write(reserve1_aft);
    }

    #[aztec(public)]
    unconstrained fn getReserves() -> (Field, Field) { // 
        (storage.reserve0.read(), storage.reserve0.read())
    }

    #[aztec(public)] 
    fn test_tranfer_token0(output_amount: Field, nonce: Field) {
        // Transfer funds to this contract
        let token0_addr = storage.token0.read();
        let from = context.msg_sender();
        let to = context.this_address();
        let _ = context.delegate_call_public_function(
            token0_addr,
            FunctionSelector::from_signature("transfer_public((Field),(Field),Field,Field)"),
            [from.to_field(), to.to_field(), 0, nonce]
        );
    }

    #[aztec(public)] 
    unconstrained fn get_reserves_0() -> pub Field {
        storage.reserve0.read().to_integer()
    }

    #[aztec(public)] 
    unconstrained fn get_reserves_1() -> pub Field {
        storage.reserve1.read().to_integer()
    }

    #[aztec(public)]
    fn spend_public_authwit(inner_hash: Field) -> Field {
        let message_hash = compute_outer_authwit_hash(
            context.msg_sender(),
            context.chain_id(),
            context.version(),
            inner_hash
        );
        context.push_new_nullifier(message_hash, 0);
        IS_VALID_SELECTOR
    }
}
