import { Handler } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";
import { gnosis, mainnet } from "viem/chains";
import { Sdk } from "../generated/graphql";
import { sdk } from "../config/subgraph";
import { validateChainId, validateNumber } from "../utils/validate";
import { datalake } from "../config/supabase";

const chainIds = [mainnet.id, gnosis.id];

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
        .select("response")
        .eq("chainId", chainId)
        .eq("disputeId", disputeId);

      if (error)
        return {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          body: JSON.stringify({ error: error.message }),
        };

      if (!data || !data.length) {
        const response = await fetch(process.env.NOTICE_METAEVIDENCE_URL, {
          method: "POST",
          body: JSON.stringify({ chainId, disputeId }),
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok)
          console.error(
            "Failed to invoke background function: ",
            await response.text()
          );
      }

      // metaEvidenceUri = data // TODO
    }

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
