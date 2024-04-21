import { MaxUint256, PERMIT2_ADDRESS, PermitTransferFrom, SignatureTransfer } from "@uniswap/permit2-sdk";
import Decimal from "decimal.js";
import { BigNumber, Wallet, ethers } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { getPayoutConfigByNetworkId } from "../../helpers/payout";
import { BotConfig } from "../../types/configuration-types";
import { decryptKeys } from "../../utils/private";
import { retryAsync, retryAsyncUntilDefined } from "ts-retry";
import { JsonRpcProvider } from "@ethersproject/providers";

export async function generateErc20PermitSignature({
  beneficiary,
  amount,
  issueId,
  userId,
  config,
}: GenerateErc20PermitSignatureParams) {
  const {
    payments: { evmNetworkId },
    keys: { evmPrivateEncrypted },
  } = config;

  if (!evmPrivateEncrypted) throw console.warn("No bot wallet private key defined");
  const { rpc, paymentToken } = getPayoutConfigByNetworkId(evmNetworkId);
  const { privateKey } = await decryptKeys(evmPrivateEncrypted);

  if (!rpc) throw console.error("RPC is not defined");
  if (!privateKey) throw console.error("Private key is not defined");
  if (!paymentToken) throw console.error("Payment token is not defined");

  const provider = await retryAsyncUntilDefined<JsonRpcProvider>(
    async () => new ethers.providers.JsonRpcProvider(rpc),
    { delay: 1000, maxTry: 5 }
  );

  const adminWallet = await retryAsync<Wallet>(
    async () => new ethers.Wallet(privateKey, provider),
    { delay: 1000, maxTry: 5 }
  );

  const permitTransferFromData: PermitTransferFrom = {
    permitted: {
      token: paymentToken,
      amount: ethers.utils.parseUnits(amount.toString(), 18),
    },
    spender: beneficiary,
    nonce: BigNumber.from(keccak256(toUtf8Bytes(`${userId}-${issueId}`))),
    deadline: MaxUint256,
  };

  const { domain, types, values } = SignatureTransfer.getPermitData(
    permitTransferFromData,
    PERMIT2_ADDRESS,
    evmNetworkId
  );

  const signature = await retryAsync<string>(
    async () => await adminWallet._signTypedData(domain, types, values),
    { delay: 1000, maxTry: 5 }
  );

  const transactionData: Erc20PermitTransactionData = {
    permit: {
      permitted: {
        token: permitTransferFromData.permitted.token,
        amount: permitTransferFromData.permitted.amount.toString(),
      },
      nonce: permitTransferFromData.nonce.toString(),
      deadline: permitTransferFromData.deadline.toString(),
    },
    transferDetails: {
      to: permitTransferFromData.spender,
      requestedAmount: permitTransferFromData.permitted.amount.toString(),
    },
    owner: adminWallet.address,
    signature: signature,
    networkId: evmNetworkId,
  };

  console.info("Generated ERC20 permit2 signature", transactionData);

  return transactionData;
}
interface GenerateErc20PermitSignatureParams {
  beneficiary: string;
  amount: Decimal;

  issueId: string;
  userId: string;
  config: BotConfig;
}

interface Erc20PermitTransactionData {
  permit: {
    permitted: {
      token: string;
      amount: string;
    };
    nonce: string;
    deadline: string;
  };
  transferDetails: {
    to: string;
    requestedAmount: string;
  };
  owner: string;
  signature: string;
  networkId: number;
}
