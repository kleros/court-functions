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
  logtail.info("Starting Meta Evidence lookup... 🔎 ['Click to see arbitrable details']", {
    chainId,
    metaEvidenceId: String(metaEvidenceId),
    arbitrable,
  });

  const batchSize = 50_000n;
  const startBlock = klerosStartBlock[chainId];
  return (
    await Promise.all(
      [...Array(Number((toBlock - startBlock) / batchSize)).keys()].map(
        (idx) => {
          const fromBlock = startBlock + batchSize * BigInt(idx);
          console.log({
            fromBlock,
            toBlock:
              fromBlock + batchSize > toBlock ? toBlock : fromBlock + batchSize,
          });
          return publicClient[chainId].getLogs({
            address: arbitrable,
            event: parseAbiItem(
              "event MetaEvidence(uint256 indexed _metaEvidenceID, string _evidence)"
            ),
            args: { _metaEvidenceID: metaEvidenceId },
            fromBlock,
            toBlock:
              fromBlock + batchSize > toBlock ? toBlock : fromBlock + batchSize,
          });
        }
      )
    )
  )
    .find((logs) => logs.length)
    ?.at(0)?.args._evidence;
};

export const handler: Handler = async (ev) => {
  try {
    if (!ev.queryStringParameters)
      throw new Error("No query parameters provided");

    const params = ev.queryStringParameters;

    const chainId = validateChainId(params.chainId, chainIds);
    const metaEvidenceId = validateBigInt(
      params.metaEvidenceId,
      "metaEvidenceId"
    );
    const arbitrable = validateAddress(params.arbitrable, "arbitrable");
    const endBlock = validateBigInt(params.endBlock, "endBlock");

    const { data } = await datalake
      .from("court-v1-metaevidence")
      .select("uri")
      .eq("chainId", chainId)
      .eq("arbitrable", arbitrable)
      .eq("metaEvidenceId", metaEvidenceId);

    if (data && data.length) throw new Error("Probably unauthorized access");

    const uri = await getMetaEvidenceUriFromLogs(
      chainId,
      metaEvidenceId,
      arbitrable,
      endBlock
    );

    if (!uri)
      throw new Error(
        `No uri found for chain ${chainId} | metaEvidence ${metaEvidenceId} | arbitrable ${arbitrable} | endBlock ${endBlock}`
      );

    const { error } = await datalake
      .from("court-v1-metaevidence")
      .insert([
        { chainId, arbitrable, metaEvidenceId: String(metaEvidenceId), uri },
      ]);
    logtail.info(`Insertion for ${arbitrable} with MetaEvidence: ${uri}`)
    if (error) throw new Error(`Datalake insertion error: ${error.message}`);

    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ metaEvidenceUri: uri }),
    };
  } catch (err: any) {
    logtail.error("Unexpected error occured; see message below.", {
      error: err.message,
    });

    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await logtail.flush();
  }
};
