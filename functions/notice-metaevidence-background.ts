import { gnosis, mainnet, sepolia } from "viem/chains";
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
import { datalake } from "../config/supabase";
import logtail from "../config/logtail";

const chainIds = [mainnet.id, gnosis.id, sepolia.id];

export const getMetaEvidenceUriFromLogs = async (
  chainId: Supported<typeof chainIds>,
  metaEvidenceId: bigint,
  arbitrable: Address,
  toBlock: bigint
) => {
  console.log("~~~ received logs", {
    chainId,
    metaEvidenceId,
    arbitrable,
    toBlock,
  });

  const logs = await publicClient[chainId].getLogs({
    address: arbitrable,
    event: parseAbiItem(
      "event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)"
    ),
    args: { _metaEvidenceID: metaEvidenceId },
    fromBlock: klerosStartBlock[chainId],
    toBlock,
  });

  console.log("~~~ received logs", logs);

  if (!logs.length) return;

  return logs.at(-1)!.args._evidence;
};

export const handler: Handler = async (ev) => {
  try {
    if (!ev.queryStringParameters)
      throw new Error("No query parameters provided");

    const params = ev.queryStringParameters;

    console.log("~~~ called bg function", params);
    const chainId = validateChainId(params.chainId, chainIds);
    const metaEvidenceId = validateBigInt(
      params.metaEvidenceId,
      "metaEvidenceId"
    );
    const arbitrable = validateAddress(params.arbitrable, "arbitrable");
    const endBlock = validateBigInt(params.endBlock, "endBlock");

    console.log("~~~ calling getMetaEvidenceUriFromLogs");
    const uri = await getMetaEvidenceUriFromLogs(
      chainId,
      metaEvidenceId,
      arbitrable,
      endBlock
    );
    console.log("~~~ received getMetaEvidenceUriFromLogs", uri);

    if (!uri)
      throw new Error(
        `No uri found for chain ${chainId} | metaEvidence ${metaEvidenceId} | arbitrable ${arbitrable} | endBlock ${endBlock}`
      );

    const { error } = await datalake
      .from("court-v1-metaevidence")
      .insert([{ chainId, metaEvidenceId, uri }]);

    if (error) throw new Error(`Datalake insertion error: ${error.message}`);

    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ metaEvidenceUri: uri }),
    };
  } catch (err: any) {
    logtail.error("~ notice-metaevidence-bg ~ error occurred", {
      error: err.message,
    });
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
