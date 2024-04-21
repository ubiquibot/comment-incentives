import { ethers } from "ethers";
import { abi as ERC20ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { retryAsync, retryAsyncUntilDefined } from "ts-retry";
import { JsonRpcProvider } from "@ethersproject/providers";

export async function getTokenSymbol(tokenAddress: string, rpcUrl: string): Promise<string> {
  const provider = await retryAsyncUntilDefined<JsonRpcProvider>(
    async () => new ethers.providers.JsonRpcProvider(rpcUrl),
    { delay: 1000, maxTry: 5 }
  );
  const contractInstance = new ethers.Contract(tokenAddress, ERC20ABI, provider);
  const symbol = await retryAsync<string>(
    async () => await contractInstance.symbol(),
    { delay: 1000, maxTry: 5 }
  );
  return symbol;
}
