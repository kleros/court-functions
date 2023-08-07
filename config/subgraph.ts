import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet, sepolia } from "viem/chains";
import { Sdk, getSdk } from "../generated/graphql";

const subgraphName = {
  [mainnet.id]: "andreimvp/kleros-display-mainnet",
  [gnosis.id]: "andreimvp/kleros-display",
  [sepolia.id]: "andreimvp/eeeeh",
} as const;

export const sdk = Object.entries(subgraphName).reduce(
  (acc, [chainId, name]) => ({
    ...acc,
    [+chainId]: getSdk(
      new GraphQLClient(`https://api.thegraph.com/subgraphs/name/${name}`)
    ),
  }),
  {} as Record<Supported<(keyof typeof subgraphName)[]>, Sdk>
);
