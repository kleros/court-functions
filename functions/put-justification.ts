import { Handler } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";
import {
  Address,
  getContract,
  keccak256,
  parseAbi,
  recoverAddress,
  toHex,
} from "viem";
import { gnosis, mainnet, sepolia } from "viem/chains";
import { publicClient } from "../config/client";
import { klerosAddress } from "../config/contracts";
import { validateChainId } from "../utils/validate";
import { dynamoDB } from "../config/dynamoDB";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { datalake } from "../config/supabase";
import logtail from "../config/logtail";

const headers = {
  "Access-Control-Allow-Origin": "*",
};

const chainIds = [mainnet.id, gnosis.id, sepolia.id];

const chainName = {
  [mainnet.id]: "mainnet",
  [gnosis.id]: "gnosischain",
  [sepolia.id]: "sepolia",
};

interface RequestBody {
  payload: {
    chainId: Supported<typeof chainIds>;
    address: Address;
    signature: Address;
    justification: {
      disputeID: number;
      appeal: number;
      voteIDs: number[];
      justification: string;
    };
  };
}

const getKleros = (chainId: Supported<typeof chainIds>) =>
  getContract({
    address: klerosAddress[chainId],
    abi: parseAbi([
      "function getVote(uint256 _disputeID, uint256 _appeal, uint256 _voteID) view returns(address account,bytes32 commit,uint256 choice,bool voted)",
    ]),
    publicClient: publicClient[chainId],
  });

export const handler: Handler = async (ev) => {
  try {
    if (ev.httpMethod === "OPTIONS")
      return { statusCode: StatusCodes.NO_CONTENT };

    if (ev.httpMethod !== "POST")
      throw new Error(
        `Invalid request method, expected POST, got ${ev.httpMethod}`
      );
    if (!ev.body) throw new Error("No body provided");

    const { payload } = JSON.parse(ev.body) as RequestBody;

    const {
      chainId: chainIdParam,
      address,
      signature,
      justification: { disputeID, appeal, voteIDs, justification },
    } = payload;

    const chainId = validateChainId(String(chainIdParam), chainIds);

    const sender = await recoverAddress({
      hash: keccak256(
        toHex(JSON.stringify({ disputeID, appeal, voteIDs, justification }))
      ),
      signature,
    });
    const derived = (
      await dynamoDB.send(
        new GetItemCommand({
          TableName: "user-settings",
          Key: { address: { S: address } },
          ProjectionExpression: "derivedAccountAddress",
        })
      )
    ).Item?.derivedAccountAddress.S;
    if (sender !== derived)
      throw new Error(
        "The sender address does not match the address in the payload"
      );

    const kleros = getKleros(chainId);
    for (const voteId of voteIDs) {
      const [voter, , , voted] = await kleros.read.getVote([
        BigInt(disputeID),
        BigInt(appeal),
        BigInt(voteId),
      ]);

      if (voter !== address || voted)
        throw new Error(
          "Not all of the supplied vote IDs belong to the supplied address and are not cast."
        );
    }

    const { error } = await datalake
      .from(`${chainName[chainId]}-justifications`)
      .insert([
        {
          disputeIDAndAppeal: `${disputeID}-${appeal}`,
          voteID: String(voteIDs[voteIDs.length - 1]),
          justification,
        },
      ]);

    if (error) throw new Error(error.message);

    logtail.info("Justification made", { disputeID, appeal });

    return {
      headers,
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ payload: payload.justification }),
    };
  } catch (err: any) {
    logtail.error("Error occurred", { error: err.message });

    return {
      headers,
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await logtail.flush();
  }
};
