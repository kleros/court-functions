import { Handler } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";
import { gnosis, mainnet, sepolia, gnosisChiado } from "viem/chains";
import { Sdk } from "../generated/graphql";
import { sdk } from "../config/subgraph";
import { validateChainId, validateNumber } from "../utils/validate";
import { datalake } from "../config/supabase";
import logtail from "../config/logtail";

const headers = {
  "Access-Control-Allow-Origin": "*",
};

const chainIds = [mainnet.id, gnosis.id, sepolia.id, gnosisChiado.id];

export const getSubgraphData = async (
  chainId: Supported<typeof chainIds>,
  key: keyof Sdk,
  id: string
) => await sdk[chainId][key]({ id });

export const handler: Handler = async (ev) => {
  try {
    if (ev.httpMethod !== "GET") throw new Error("Wrong method");
    if (!ev.queryStringParameters)
      throw new Error("No query parameters provided");

    const params = ev.queryStringParameters;

    const chainId = validateChainId(params.chainId, chainIds);
    const disputeId = validateNumber(params.disputeId, "disputeId");

    const subgraphData = await getSubgraphData(
      chainId,
      "Dispute",
      String(disputeId)
    );
    if (!subgraphData || !subgraphData.dispute)
      throw new Error("invalid dispute or subgraph error");

    let metaEvidenceUri = subgraphData.dispute.arbitrableHistory?.metaEvidence;

    if (!metaEvidenceUri) {
      const { data, error } = await datalake
        .from("court-v1-metaevidence")
        .select("uri")
        .eq("chainId", chainId)
        .eq("arbitrable", subgraphData.dispute.arbitrated)
        .eq("metaEvidenceId", subgraphData.dispute.metaEvidenceId);

      if (error)
        return {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          body: JSON.stringify({ error: error.message }),
        };

      if (data && data.length) {
        metaEvidenceUri = data[0].uri;
      } else {
        const response = await fetch(
          process.env.URL +
            "/.netlify/functions/notice-metaevidence-background" +
            `?chainId=${chainId}` +
            `&metaEvidenceId=${subgraphData.dispute.metaEvidenceId}` +
            `&arbitrable=${subgraphData.dispute.arbitrated}` +
            `&endBlock=${subgraphData.dispute.createdAtBlock}`,
          { method: "POST" }
        );

        if (!response.ok)
          logtail.error("Failed to invoke background function: ", {
            error: await response.text(),
          });
      }
    }

    return {
      headers,
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ metaEvidenceUri }),
    };
  } catch (err: any) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    logtail.flush();
  }
};
