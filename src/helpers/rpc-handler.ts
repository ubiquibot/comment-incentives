import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";

export function useHandler(networkId: number) {
  const config: HandlerConstructorConfig = {
    networkId: String(networkId) as NetworkId,
    networkName:  null,     // will default using the networkRpcs
    networkRpcs:  null,     // e.g "https://mainnet.infura.io/..."
    runtimeRpcs:  null,     // e.g "<networkId>__https://mainnet.infura.io/..." > "1__https://mainnet.infura.io/..."
    autoStorage: false,     // browser only, will store in localStorage
    cacheRefreshCycles: 5,  // bad RPCs are excluded if they fail, this is how many cycles before they're re-tested
    rpcTimeout: 1500,       // when the RPCs are tested they are raced, this is the max time to allow for a response
    tracking: "yes",        // accepted values: "yes" | "limited" | "none". This is the data tracking status of the RPC, not this package.
    proxySettings: {
      retryCount: 3,        // how many times we'll loop the list of RPCs retrying the request before failing
      retryDelay: 100,      // (ms) how long we'll wait before moving to the next RPC, best to keep this low
      logTier: "ok",        // |"info"|"error"|"debug"|"fatal"|"verbose"; set to "none" for no logs, null will default to "error", "verbose" will log all
      logger: null,         // null will default to PrettyLogs
      strictLogs: true,     // true, only the specified logTier will be logged and false all wll be logged.
    }
  };
  return new RPCHandler(config);
}