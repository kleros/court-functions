import { gnosis, mainnet, sepolia, gnosisChiado } from "viem/chains";

export const klerosAddress = {
  [mainnet.id]: "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069",
  [gnosis.id]: "0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002",
  [sepolia.id]: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879",
  [gnosisChiado.id]: "0xD8798DfaE8194D6B4CD6e2Da6187ae4209d06f27",
} as const;

export const klerosStartBlock = {
  [mainnet.id]: 7303699n,
  [gnosis.id]: 16895601n,
  [sepolia.id]: 3635742n,
  [gnosisChiado.id]: 1165867n,
} as const;
