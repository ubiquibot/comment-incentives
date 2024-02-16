# @ubiquibot/comment-incentives

This is the backend of the UbiquiBot comment incentives system. It is a serverless function that is runs natively inside of GitHub Actions.

### Generating a new `evmPrivateKeyEncrypted`

1. Export evm private key of the new wallet
2. Open https://pay.ubq.fi/keygen
3. Insert `x25519_private_key` in the "X25519_PRIVATE_KEY" field (I've DMed you this value on 25 Dec, check telegram)
4. Insert evm private key in the "PLAIN_TEXT" field
5. Click "Encrypt"
6. Insert the value from the "CIPHER_TEXT" field in the bot's config (not sure where exactly)

### Default shared evmPrivateKeyEncrypted

Default shared evmPrivateKeyEncrypted key was generated for new shared account address
0x3a2E44e10AbEf5CB4a6E492c5ba93d30068d2D95

Source https://github.com/ubiquibot/comment-incentives/issues/3#issuecomment-1919082099
