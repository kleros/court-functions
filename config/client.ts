import { createPublicClient, http } from "viem";
import { gnosis, mainnet, sepolia } from "viem/chains";

export const publicClient = {
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_MAINNET),
  }),
  [gnosis.id]: createPublicClient({
    chain: gnosis,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_GNOSIS),
  }),
  [sepolia.id]: createPublicClient({
    chain: sepolia,
    transport: http(process.env.PRIVATE_RPC_ENDPOINT_SEPOLIA),
  }),
};
