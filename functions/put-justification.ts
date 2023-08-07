import { Handler } from "@netlify/functions";
import { Logtail } from "@logtail/node";
import { createClient } from "@supabase/supabase-js";
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
import { datalake } from "../config/supabase";
import logtail from "../config/logtail";

const chainIds = [mainnet.id, gnosis.id, sepolia.id];

const chainName = {
  [mainnet.id]: "mainnet",
  [gnosis.id]: "gnosischain",
  [sepolia.id]: "sepolia",
};

interface RequestBody {
  payload: {
    network: Supported<typeof chainIds>;
    address: Address;
    justification: {
      disputeID: number;
      appeal: number;
      voteIDs: number[];
      justification: string;
    };
  };
  signature: Address;
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
    if (ev.httpMethod !== "PUT")
      throw new Error("Invalid request method, expected PUT");
    if (!ev.body) throw new Error("No body provided");

    const { payload, signature } = JSON.parse(ev.body) as RequestBody;

    const {
      network: chainIdParam,
      justification: { disputeID, appeal, voteIDs, justification },
    } = payload;

    const chainId = validateChainId(String(chainIdParam), chainIds);

    const sender = await recoverAddress({
      hash: keccak256(toHex(JSON.stringify(payload))),
      signature,
    });
    if (sender !== payload.address)
      throw new Error(
        `The sender address does not match the address in the payload`
      );

    const kleros = getKleros(chainId);
    for (const voteId of voteIDs) {
      const [account, , , voted] = await kleros.read.getVote([
        BigInt(disputeID),
        BigInt(appeal),
        BigInt(voteId),
      ]);

      if (account !== payload.address || voted)
        throw new Error(
          "Not all of the supplied vote IDs belong to the supplied address and are not cast."
        );
    }

    const { error } = await datalake
      .from(`${chainName[payload.network]}-justifications`)
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
      statusCode: StatusCodes.OK,
      body: JSON.stringify({ payload: { votes: payload.justification } }),
    };
  } catch (err: any) {
    logtail.error("Error occurred", { error: err.message });

    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await logtail.flush();
  }
};
