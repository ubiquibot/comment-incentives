> [!WARNING]  
> This repository has been archived in favor of https://github.com/ubiquibot/conversation-rewards

# @ubiquibot/comment-incentives

This document outlines the setup for the UbiquiBot comment incentives system, a serverless function hosted by GitHub Actions.

### Default Key Pair for Generating Permits in Development

- Normally other repositories which invoke this plugin (via UbiquiBot) contain the `evmPrivateEncrypted`. 
- The only way to decode it is with our secret `X25519_PRIVATE_KEY` saved within the UbiquiBot kernel's runtime secrets. 
- The only time that the following key pair information is used is during development, when testing this plugin standalone. 
- The account associated with these keys should hold no funds.

|                       |                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X25519_PRIVATE_KEY`  | `627H-BcWbcp_O3YmQGIA6MqgxVsFuplFCA9DK3iC7GQ`                                                                                                           |
| `X25519_PUBLIC_KEY`   | `nr416sZIvO-g1cnMyP6pNf4-DhQ02tWhP1atk03u4z8`                                                                                                           |
| `evmPrivateEncrypted` | `ndRZX-GoUC-bNdj_F7Buy8wM_FteiT_unbSpwMg1DBPXnnA2i94JNAsA92FfH3SATVPxQcjKFP9AuFK4T056r4zik0f8ROYsG1mbTcA7ftgm7LR24LCJLWIxpPxWxZ2UTUoAMj2pfoX9WYI0nm1-Q` |
| `evmPublicAddress`    | `0x3a2E44e10AbEf5CB4a6E492c5ba93d30068d2D95`                                                                                                            |
| `evmPrivateKey`       | `a29c749482b5d7e5987895a76f3d23002f3a3e1fabb26d370b7403ddead8926a`                                                                                      |


### Generating a new `evmPrivateKeyEncrypted`

To generate a new encrypted EVM private key:

1. Export the new wallet's EVM private key.
2. Visit https://pay.ubq.fi/keygen.
3. Enter the `x25519_private_key` into the "X25519_PRIVATE_KEY" field (sent via Telegram DM on Dec 25).
4. Input the EVM private key into the "PLAIN_TEXT" field.
5. Click "Encrypt".
6. Place the "CIPHER_TEXT" value into the bot's configuration file (location unspecified).
   Source: [UbiquiBot GitHub Issue](https://github.com/ubiquibot/comment-incentives/issues/3#issuecomment-1919082099)
