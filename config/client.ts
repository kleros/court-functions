import { createPublicClient, http } from "viem";
import { gnosis, mainnet, sepolia } from "viem/chains";

export const publicClient = {
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_MAINNET, {
      timeout: 600_000,
    }),
  }),
  [gnosis.id]: createPublicClient({
    chain: gnosis,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_GNOSIS, {
      timeout: 600_000,
    }),
  }),
  [sepolia.id]: createPublicClient({
    chain: sepolia,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_SEPOLIA, {
      timeout: 600_000,
    }),
  }),
};
