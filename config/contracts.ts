import { gnosis, mainnet, sepolia } from "viem/chains";

export const klerosAddress = {
  [mainnet.id]: "0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002",
  [gnosis.id]: "0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002",
  [sepolia.id]: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879",
} as const;

export const klerosStartBlock = {
  [mainnet.id]: 7303699n,
  [gnosis.id]: 16895601n,
  [sepolia.id]: 3635742n,
} as const;
