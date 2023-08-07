import { gnosis, mainnet } from "viem/chains";

export const klerosAddress = {
  [mainnet.id]: "0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002",
  [gnosis.id]: "0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002",
} as const;

export const klerosStartBlock = {
  [mainnet.id]: 7303699n,
  [gnosis.id]: 16895601n,
} as const;
