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
        reserve0: PublicMutable<Field>,
        reserve1: PublicMutable<Field>,
    }

    #[aztec(public)]
    #[aztec(initializer)] // annotation to mark function as a constructor
    fn constructor(_token0: AztecAddress, _token1: AztecAddress) {
        storage.token0.write(_token0);
        storage.token1.write(_token1);
    }

    #[aztec(public)] 
    fn tranfer_token0(to: AztecAddress, output_amount: Field, nonce_for_transfer_approval: Field) {
        // Transfer funds to this contract
        let token0_addr = storage.token0.read();
        Token::at(token0_addr).transfer_public(
            &mut context,
            context.this_address(),
            to,
            output_amount,
            nonce_for_transfer_approval
        );

        // let curr_amount = Token::at(storage.token0.read()).balance_of_public(
        //     &mut context,
        //     context.msg_sender()
        // );

        // storage.reserve0.write(curr_amount - output_amount);
    }

    // #[aztec(public)] 
    // unconstrained fn balance_of_public(owner: AztecAddress) -> Field {
    //     let res = Token::at(storage.token0.read()).balance_of_public(
    //         // context.this_address()
    //     );
    //     res[0]
    // }

}
