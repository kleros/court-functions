import { gnosis, mainnet } from "viem/chains";
import { klerosStartBlock } from "../config/contracts";
import { publicClient } from "../config/client";
import { Address, parseAbiItem } from "viem";
import { Handler } from "@netlify/functions";
import {
  validateAddress,
  validateBigInt,
  validateChainId,
} from "../utils/validate";
import { StatusCodes } from "http-status-codes";

const chainIds = [mainnet.id, gnosis.id];

export const getMetaEvidenceUriFromLogs = async (
  chainId: Supported<typeof chainIds>,
  metaEvidenceId: bigint,
  arbitrable: Address,
  toBlock: bigint
) => {
  const logs = await publicClient[chainId].getLogs({
    address: arbitrable,
    event: parseAbiItem(
      "event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)"
    ),
    args: { _metaEvidenceID: metaEvidenceId },
    fromBlock: klerosStartBlock[chainId],
    toBlock,
  });

  if (!logs.length) return;

  return logs.at(-1)!.args._evidence;
};

export const handler: Handler = async (ev) => {
  try {
    if (!ev.queryStringParameters)
      throw new Error("No query parameters provided");

    const params = ev.queryStringParameters;

    const metaEvidenceUri = await getMetaEvidenceUriFromLogs(
      validateChainId(params.chainId, chainIds),
      validateBigInt(params.metaEvidenceId, "metaEvidenceId"),
      validateAddress(params.arbitrable, "arbitrable"),
      validateBigInt(params.endBlock, "endBlock")
    );

    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ metaEvidenceUri }),
    };
  } catch (err: any) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
