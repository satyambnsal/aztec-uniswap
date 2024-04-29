mod interfaces;


contract UniswapV2 {
    use dep::aztec::prelude::{
        AztecAddress, FunctionSelector, NoteHeader, NoteInterface, NoteGetterOptions, PrivateContext,
        Map, PublicMutable
    };
    use dep::aztec::context::{Context, gas::GasOpts};
    use crate::interfaces::Token;
    // use dep::token::Token;

    #[aztec(storage)]
    struct Storage {
        token0: PublicMutable<AztecAddress>,
        token1: PublicMutable<AztecAddress>,
        reserve0: PublicMutable<u64>,
        reserve1: PublicMutable<u64>,
        total_supply: PublicMutable<u64>,
        liquidity_balance: Map<AztecAddress, PublicMutable<u64>>
    }

    #[aztec(public)]
    #[aztec(initializer)] // annotation to mark function as a constructor
    fn constructor(_token0: AztecAddress, _token1: AztecAddress) {
        storage.token0.write(_token0);
        storage.token1.write(_token1);
    }

    #[aztec(public)]
    fn mint(amount0: u64, amount1: u64, nonce0: Field, nonce1: Field) -> Field {  // returns liquity
        let (_reserve0, _reserve1) = (storage.reserve0.read(), storage.reserve0.read());
        let token0_addr = storage.token0.read();
        let token1_addr = storage.token1.read();

        let this_addr = context.this_address();
        let msg_sender = context.msg_sender();

        assert((amount0 > 0) & (amount1 > 0), "Should add liquidity tokens first!");
        // transfer liquity in
        Token::at(token0_addr).transfer_public(
            &mut context,
            msg_sender,
            this_addr,
            amount0 as Field,
            nonce0
        );

        Token::at(token1_addr).transfer_public(
            &mut context,
            msg_sender,
            this_addr,
            amount1 as Field,
            nonce1
        );

        let total_supply = storage.total_supply.read();
        let reserve0 = storage.reserve0.read();
        let reserve1 = storage.reserve1.read();
        let mut liquidity = 0;
        if (total_supply == 0 ) {
            liquidity = amount0 * amount1;
        } else {   // TODO, the result should be sqrted
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
        storage.liquidity_balance.at(msg_sender).write(liquidity);

        // update reserve
        storage.reserve0.write(reserve0 + amount0);
        storage.reserve1.write(reserve1 + amount1);
    }

    #[aztec(public)]
    unconstrained fn getReserves() -> (Field, Field) {  // 
        (storage.reserve0.read(), storage.reserve0.read())
    }

    #[aztec(public)] 
    fn tranfer_token0(output_amount: Field, nonce: Field) {
        // Transfer funds to this contract
        let token0_addr = storage.token0.read();
        let from = context.msg_sender();
        let to = context.this_address();
        let _ = context.delegate_call_public_function(
            token0_addr,
            FunctionSelector::from_signature("transfer_public((Field),(Field),Field,Field)"),
            [from.to_field(), to.to_field(), output_amount, nonce],
        );
        // Token::at(token0_addr).transfer_public(
        //     &mut context,
        //     context.msg_sender(),
        //     context.this_address(),
        //     output_amount,
        //     nonce
        // );
    }

    // #[aztec(public)] 
    // unconstrained fn balance_of_public(owner: AztecAddress) -> Field {
    //     let res = Token::at(storage.token0.read()).balance_of_public(
    //         // context.this_address()
    //     );
    //     res[0]
    // }

}
