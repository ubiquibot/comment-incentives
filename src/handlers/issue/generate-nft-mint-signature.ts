import { BigNumberish, ethers, utils } from "ethers";
import { getPayoutConfigByNetworkId } from "../../helpers/payout";
import { MaxUint256 } from "@uniswap/permit2-sdk";

const NFT_MINTER_PRIVATE_KEY = process.env.NFT_MINTER_PRIVATE_KEY as string;
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS as string;
const NFT_CONTRACT_CHAIN_ID = parseInt(process.env.NFT_CONTRACT_CHAIN_ID as string);
const SIGNING_DOMAIN_NAME = "NftReward-Domain";
const SIGNING_DOMAIN_VERSION = "1";

interface NftMintRequest {
  beneficiary: string;
  deadline: BigNumberish;
  keys: string[];
  nonce: BigNumberish;
  values: string[];
}

const domain = {
  name: SIGNING_DOMAIN_NAME,
  version: SIGNING_DOMAIN_VERSION,
  verifyingContract: NFT_CONTRACT_ADDRESS,
  chainId: NFT_CONTRACT_CHAIN_ID,
};

const types = {
  MintRequest: [
    { name: "beneficiary", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "keys", type: "bytes32[]" },
    { name: "nonce", type: "uint256" },
    { name: "values", type: "string[]" },
  ],
};

const keys = [
  "GITHUB_ORGANIZATION_NAME",
  "GITHUB_REPOSITORY_NAME",
  "GITHUB_ISSUE_ID",
  "GITHUB_USERNAME",
  "GITHUB_CONTRIBUTION_TYPE",
];

interface NftMintRequestData {
  request: {
    beneficiary: string;
    deadline: string;
    keys: string[];
    nonce: string;
    values: string[];
  };
  nftMetadata: Record<string, string>;
  nftAddress: string;
  networkId: number;
  signature: string;
}

export async function generateNftMintSignature(
  organizationName: string,
  repositoryName: string,
  issueId: string,
  beneficiary: string,
  username: string,
  contributionType: string
) {
  const { rpc } = getPayoutConfigByNetworkId(NFT_CONTRACT_CHAIN_ID);

  let provider;
  let adminWallet;
  try {
    provider = new ethers.providers.JsonRpcProvider(rpc);
  } catch (error) {
    throw console.error("Failed to instantiate provider", error);
  }

  try {
    adminWallet = new ethers.Wallet(NFT_MINTER_PRIVATE_KEY, provider);
  } catch (error) {
    throw console.error("Failed to instantiate wallet", error);
  }

  const nftMintRequest: NftMintRequest = {
    beneficiary: beneficiary,
    deadline: MaxUint256,
    keys: keys.map((key) => utils.keccak256(utils.toUtf8Bytes(key))),
    nonce: MaxUint256,
    values: [organizationName, repositoryName, issueId, username, contributionType],
  };

  const signature = await adminWallet._signTypedData(domain, types, nftMintRequest).catch((error) => {
    throw console.error("Failed to sign typed data", error);
  });

  const nftMetadata: Record<string, string> = {};

  keys.forEach((element, index) => {
    nftMetadata[element] = nftMintRequest.values[index];
  });

  const transactionData: NftMintRequestData = {
    request: {
      beneficiary: nftMintRequest.beneficiary,
      deadline: nftMintRequest.deadline.toString(),
      keys: nftMintRequest.keys,
      nonce: nftMintRequest.nonce.toString(),
      values: nftMintRequest.values,
    },
    nftMetadata,
    nftAddress: NFT_CONTRACT_ADDRESS,
    networkId: NFT_CONTRACT_CHAIN_ID,
    signature: signature,
  };

  console.info("Generated nft mint signature", { transactionData });

  return transactionData;
}
