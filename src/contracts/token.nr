mod types;

contract Token {

  use dep::compressed_string::FieldCompressedString;
  use dep::aztec::prelude::{
    NoteGetterOptions, NoteHeader, Map, PublicMutable, SharedImmutable, PrivateSet, FunctionSelector, AztecAddress
  };
  use dep::aztec::hash::compute_secret_hash;
  use dep::authwit::{auth::{assert_current_call_valid_authwit, assert_current_call_valid_authwit_public}};
  

  #[aztec(private)]
  fn constructor() {}

    #[aztec(public)]
  fn set_admin(new_admin: AztecAddress) {}

    #[aztec(public)]
  fn set_minter(minter: AztecAddress, approve: bool) {}

    #[aztec(public)]
  fn mint_public(to: AztecAddress, amount: Field) -> Field {}

    #[aztec(public)]
  fn mint_private(amount: Field, secret_hash: Field) -> Field {}

    #[aztec(public)]
  fn shield(from: AztecAddress, amount: Field, secret_hash: Field, nonce: Field) -> Field {}

    #[aztec(public)]
  fn transfer_public(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {}

    #[aztec(public)]
  fn burn_public(from: AztecAddress, amount: Field, nonce: Field) -> Field {}

    // Private functions

    #[aztec(private)]
  fn redeem_shield(to: AztecAddress, amount: Field, secret: Field) -> Field {}

    #[aztec(private)]
  fn unshield(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {}

    #[aztec(private)]
  fn transfer(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {}

    #[aztec(private)]
  fn burn(from: AztecAddress, amount: Field, nonce: Field) -> Field {}

  #[aztec(public)]
  fn _initialize(new_admin: AztecAddress) {

  }

  #[aztec(public)]
  internal fn _increase_public_balance(to: AztecAddress, amount: Field) {

  }

  #[aztec(public)]
  internal fn _reduce_total_supply(amount: Field) {

  }

  // Unconstrained functions

  unconstrained fn admin() -> Field {

  }

  unconstrained fn is_minter(minter: AztecAddress) -> bool {

  }

  unconstrained fn total_supply() -> Field {

  }

  unconstrained fn balance_of_private(owner: AztecAddress) -> Field {

  }

  unconstrained fn balance_of_public(owner: AztecAddress) -> Field {
    
  }
}
