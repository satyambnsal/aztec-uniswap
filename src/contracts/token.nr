contract Token {

    use dep::compressed_string::FieldCompressedString;
    use dep::aztec::prelude::{
        NoteGetterOptions, NoteHeader, Map, PublicMutable, SharedImmutable, PrivateSet,
        FunctionSelector, AztecAddress
    };
    use dep::aztec::hash::compute_secret_hash;
    use dep::authwit::{auth::{assert_current_call_valid_authwit, assert_current_call_valid_authwit_public}};
    use crate::types::{transparent_note::TransparentNote, token_note::TokenNote, balances_map::BalancesMap};

    #[aztec(storage)]
  struct Storage {
    admin: PublicMutable<AztecAddress>,
    minters: Map<AztecAddress, PublicMutable<bool>>,
    total_supply: PublicMutable<U128>,
    public_balances: Map<AztecAddress,PublicMutable<U128>>,
    symbol: SharedImmutable<FieldCompressedString>,
    name: SharedImmutable<FieldCompressedString>,
    decimals: SharedImmutable<u8>,
    pending_shields: PrivateSet<TransparentNote>,
    balances: BalancesMap<TokenNote>
  }

    #[aztec(public)]
  #[aztec(initializer)]
  fn constructor(admin: AztecAddress, name: str<31>, symbol: str<31>, decimals: u8) {
        assert(!admin.is_zero(), "invalid admin");
        storage.admin.write(admin);
        storage.minters.at(admin).write(true);
        storage.name.initialize(FieldCompressedString::from_string(name));
        storage.symbol.initialize(FieldCompressedString::from_string(symbol));
        storage.decimals.initialize(decimals);
    }

    #[aztec(public)]
  fn set_admin(new_admin: AztecAddress) {
        assert(storage.admin.read().eq(context.msg_sender()), "caller is not admin");
    }

    #[aztec(public)]
  fn set_minter(minter: AztecAddress, approve: bool) {
        assert(storage.admin.read().eq(context.msg_sender()), "caller is not admin");
        storage.minters.at(minter).write(approve);
    }

    #[aztec(public)]
  fn mint_public(to: AztecAddress, amount: Field) -> Field {
        assert(storage.minters.at(context.msg_sender()).read(), "caller is not minter");
        let amount = U128::from_integer(amount);
        let new_balance = storage.public_balances.at(to).read().add(amount);
        let new_supply = storage.total_supply.read().add(amount);

        storage.public_balances.at(to).write(new_balance);
        storage.total_supply.write(new_supply);
    }

    #[aztec(public)]
  fn mint_private(amount: Field, secret_hash: Field) -> Field {
        assert(storage.minters.at(context.msg_sender()).read(), "caller is not minter");

        let pending_shields = storage.pending_shields;
        let mut note = TransparentNote::new(amount, secret_hash);
        let new_supply = storage.total_supply.read().add(U128::from_integer(amount));

        storage.total_supply.write(new_supply);
        pending_shields.insert_from_public(&mut note);
    }

    #[aztec(public)]
  fn shield(from: AztecAddress, amount: Field, secret_hash: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let amount_int = U128::from_integer(amount);
        let from_balance_new = storage.public_balances.at(from).read().sub(amount_int);
        let pending_shields = storage.pending_shields;
        let mut note = TransparentNote::new(amount, secret_hash);
        storage.public_balances.at(from).write(from_balance_new);
        pending_shields.insert_from_public(&mut note);
    }

    #[aztec(public)]
  fn transfer_public(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let amount = U128::from_integer(amount);
        let from_balance_new = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance_new);

        let to_balance_new = storage.public_balances.at(to).read().add(amount);
        storage.public_balances.at(to).write(to_balance_new);
    }

    #[aztec(public)]
  fn burn_public(from: AztecAddress, amount: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit_public(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let amount = U128::from_integer(amount);
        let from_balance_new = storage.public_balances.at(from).read().sub(amount);
        storage.public_balances.at(from).write(from_balance_new);

        let new_supply = storage.total_supply.read().sub(amount);
        storage.total_supply.write(new_supply);
    }

    // Private functions

    #[aztec(private)]
  fn redeem_shield(to: AztecAddress, amount: Field, secret: Field) -> Field {
        let pending_shields = storage.pending_shields;
        let secret_hash = compute_secret_hash(secret);

        let mut options = NoteGetterOptions::new();
        options = options.select(TransparentNote::properties().amount, amount, Option::none()).select(
TransparentNote::properties().secret_hash, secret_hash, Option::none()
    ).set_limit(1);

        let notes = pending_shields.get_notes(options);
        let note = notes[0].unwrap_unchecked();
        pending_shields.remove(note);
        storage.balances.add(to, U128::from_integer(amount));
    }

    #[aztec(private)]
  fn unshield(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        storage.balances.sub(from, U128::from_integer(amount));

        let selector = FunctionSelector::from_signature("_increase_public_balance((Field),Field");
        let _void = context.call_public_function(context.this_address(), selector, [to.to_field(), amount]);
    }

    #[aztec(private)]
  fn transfer(from: AztecAddress, to: AztecAddress, amount: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        let amount = U128::from_integer(amount);
        storage.balances.sub(from, amount);
        storage.balances.add(to, amount);
    }

    #[aztec(private)]
  fn burn(from: AztecAddress, amount: Field, nonce: Field) -> Field {
        if (!from.eq(context.msg_sender())) {
            assert_current_call_valid_authwit(&mut context, from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        storage.balances.sub(from, U128::from_integer(amount));

        let selector = FunctionSelector::from_signature("_reduce_total_supply(Field)");
        let _void = context.call_public_function(context.this_address(), selector, [amount]);
    }

    #[aztec(public)]
  fn _initialize(new_admin: AztecAddress) {}

    #[aztec(public)]
  #[aztec(internal)]
  fn _increase_public_balance(to: AztecAddress, amount: Field) {
        let new_balance = storage.public_balances.at(to).read().add(U128::from_integer(amount));
        storage.public_balances.at(to).write(new_balance);
    }

    #[aztec(public)]
    #[aztec(internal)]
  fn _reduce_total_supply(amount: Field) {
        let new_supply = storage.total_supply.read().sub(U128::from_integer(amount));
        storage.total_supply.write(new_supply);
    }

    // Unconstrained functions

    unconstrained fn admin() -> pub Field {
        storage.admin.read().to_field()
    }

    unconstrained fn is_minter(minter: AztecAddress) -> pub bool {
        storage.minters.at(minter).read()
    }

    unconstrained fn total_supply() -> pub Field {
        storage.total_supply.read().to_field()
    }

    unconstrained fn balance_of_private(owner: AztecAddress) -> pub Field {
        storage.balances.balance_of(owner).to_integer()
    }

    unconstrained fn balance_of_public(owner: AztecAddress) -> pub Field {
        storage.public_balances.at(owner).read().to_field()
    }
}
