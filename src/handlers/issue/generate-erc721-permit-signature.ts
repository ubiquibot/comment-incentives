import { BigNumber, ethers, utils } from "ethers";
import { getPayoutConfigByNetworkId } from "../../helpers/payout";
import { MaxUint256 } from "@uniswap/permit2-sdk";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

const NFT_MINTER_PRIVATE_KEY = process.env.NFT_MINTER_PRIVATE_KEY as string;
const NFT_CONTRACT_ADDRESS = "0x6a87f05a74AB2EC25D1Eea0a3Cd24C3A2eCfF3E0";
const NFT_CONTRACT_NETWORK_ID = 100;
const SIGNING_DOMAIN_NAME = "NftReward-Domain";
const SIGNING_DOMAIN_VERSION = "1";

interface Erc721PermitSignatureData {
  beneficiary: string;
  deadline: BigNumber;
  keys: string[];
  nonce: BigNumber;
  values: string[];
}

const domain = {
  name: SIGNING_DOMAIN_NAME,
  version: SIGNING_DOMAIN_VERSION,
  verifyingContract: NFT_CONTRACT_ADDRESS,
  chainId: NFT_CONTRACT_NETWORK_ID,
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

interface Erc721PermitTransactionData {
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

type GenerateErc721PermitSignatureParams = {
  organizationName: string;
  repositoryName: string;
  issueId: string;
  issueNumber: string;
  beneficiary: string;
  username: string;
  contributionType: string;
};

export async function generateErc721PermitSignature({
  organizationName,
  repositoryName,
  issueNumber,
  issueId,
  beneficiary,
  username,
  contributionType,
}: GenerateErc721PermitSignatureParams) {
  const { rpc } = getPayoutConfigByNetworkId(NFT_CONTRACT_NETWORK_ID);

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

  const erc721SignatureData: Erc721PermitSignatureData = {
    beneficiary: beneficiary,
    deadline: MaxUint256,
    keys: keys.map((key) => utils.keccak256(utils.toUtf8Bytes(key))),
    nonce: BigNumber.from(keccak256(toUtf8Bytes(issueId))),
    values: [organizationName, repositoryName, issueNumber, username, contributionType],
  };

  const signature = await adminWallet._signTypedData(domain, types, erc721SignatureData).catch((error) => {
    throw console.error("Failed to sign typed data", error);
  });

  const nftMetadata: Record<string, string> = {};

  keys.forEach((element, index) => {
    nftMetadata[element] = erc721SignatureData.values[index];
  });

  const erc721Data: Erc721PermitTransactionData = {
    request: {
      beneficiary: erc721SignatureData.beneficiary,
      deadline: erc721SignatureData.deadline.toString(),
      keys: erc721SignatureData.keys,
      nonce: erc721SignatureData.nonce.toString(),
      values: erc721SignatureData.values,
    },
    nftMetadata,
    nftAddress: NFT_CONTRACT_ADDRESS,
    networkId: NFT_CONTRACT_NETWORK_ID,
    signature: signature,
  };

  console.info("Generated ERC721 permit signature", { erc721Data });

  return erc721Data;
}
