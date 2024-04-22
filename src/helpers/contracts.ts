import { ethers } from "ethers";
import { abi as ERC20ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { retryAsync, retryAsyncUntilDefined } from "ts-retry";
import { JsonRpcProvider } from "@ethersproject/providers";


export async function getTokenSymbol(tokenAddress: string, rpcUrl: string): Promise<string>;
export async function getTokenSymbol(tokenAddress: string, provider: JsonRpcProvider): Promise<string>;
export async function getTokenSymbol(tokenAddress: string, rpc: string|JsonRpcProvider): Promise<string> {
  let provider: JsonRpcProvider;

  if (typeof rpc === "string") {
      provider = await retryAsyncUntilDefined<JsonRpcProvider>(
        async () => new ethers.providers.JsonRpcProvider(rpc),
        { maxTry: 5 }
      );
  } else provider = rpc;

  const contractInstance = new ethers.Contract(tokenAddress, ERC20ABI, provider);
  const symbol = await retryAsync<string>(
    async () => await contractInstance.symbol(),
    { maxTry: 5 }
  );
  return symbol;
}

