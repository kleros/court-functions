import { isAddress } from "viem";

export const validateString = (param: string | undefined, label: string) => {
  if (!param) throw new Error(`${label} missing`);
  return param;
};

export const validateNumber = (param: string | undefined, label: string) => {
  const asString = validateString(param, label);
  if (isNaN(+asString)) throw new Error(`${label} must be valid number`);
  return +asString;
};

export const validateBigInt = (param: string | undefined, label: string) => {
  const asString = validateString(param, label);
  return BigInt(asString);
};

export const validateAddress = (param: string | undefined, label: string) => {
  const asString = validateString(param, label);
  if (!isAddress(asString)) throw new Error(`${label} must be valid address`);
  return asString;
};

export const validateChainId = <S extends number>(
  param: string | undefined,
  supported: S[]
) => {
  const asString = validateString(param, "chainId");
  const asNumber = validateNumber(asString, "chainId") as S;
  if (!supported.includes(asNumber)) throw new Error("unsupported network");
  return asNumber;
};
