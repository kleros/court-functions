import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet, sepolia } from "viem/chains";
import { Sdk, getSdk } from "../generated/graphql";

const subgraphUrl = {
  [mainnet.id]:
    "https://api.studio.thegraph.com/query/61738/kleros-display-mainnet/version/latest",
  [gnosis.id]:
    "https://api.studio.thegraph.com/query/61738/kleros-display-gnosis/version/latest",
  [sepolia.id]:
    "https://api.studio.thegraph.com/query/61738/kleros-display-sepolia/version/latest",
} as const;

export const sdk = Object.entries(subgraphUrl).reduce(
  (acc, [chainId, url]) => ({
    ...acc,
    [+chainId]: getSdk(new GraphQLClient(url)),
  }),
  {} as Record<Supported<(keyof typeof subgraphUrl)[]>, Sdk>
);
