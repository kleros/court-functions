import { Handler } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";
import { mainnet, gnosis, sepolia, gnosisChiado } from "viem/chains";
import { validateChainId, validateNumber } from "../utils/validate";
import { datalake } from "../config/supabase";

const headers = {
  "Access-Control-Allow-Origin": "*",
};

const chainIds = [mainnet.id, gnosis.id, sepolia.id, gnosisChiado.id];

const chainDBName = {
  [mainnet.id]: "mainnet",
  [gnosis.id]: "gnosischain",
  [sepolia.id]: "sepolia",
  [gnosisChiado.id]: "chiado",
};

export const handler: Handler = async (ev) => {
  try {
    if (ev.httpMethod !== "GET") throw new Error("Wrong method");
    if (!ev.queryStringParameters)
      throw new Error("No query parameters provided");

    const params = ev.queryStringParameters;

    const chainId = validateChainId(params.chainId, chainIds);
    const disputeId = validateNumber(params.disputeId, "disputeId");
    const round = validateNumber(params.round, "round");

    const { data, error } = await datalake
      .from(`${chainDBName[chainId]}-justifications`)
      .select("*")
      .eq("disputeIDAndAppeal", `${disputeId}-${round}`);

    if (error)
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        body: JSON.stringify({ error: error.message }),
      };

    return {
      headers,
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ payload: { justifications: data } }),
    };
  } catch (err: any) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
