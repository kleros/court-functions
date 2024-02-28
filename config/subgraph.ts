import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet, sepolia } from "viem/chains";
import { Sdk, getSdk } from "../generated/graphql";

const subgraphUrl = {
  [mainnet.id]:
    "https://api.thegraph.com/subgraphs/name/kleros/kleros-display-mainnet",
  [gnosis.id]:
    "https://api.thegraph.com/subgraphs/name/kleros/kleros-display-gnosis",
  [sepolia.id]:
    "https://api.thegraph.com/subgraphs/name/kleros/kleros-display-sepolia",
} as const;

export const sdk = Object.entries(subgraphUrl).reduce(
  (acc, [chainId, url]) => ({
    ...acc,
    [+chainId]: getSdk(new GraphQLClient(url)),
  }),
  {} as Record<Supported<(keyof typeof subgraphUrl)[]>, Sdk>
);
