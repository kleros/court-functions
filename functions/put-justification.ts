import { Handler } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";
import { Address, getContract, parseAbi, recoverMessageAddress } from "viem";
import { gnosis, mainnet, sepolia } from "viem/chains";
import { publicClient } from "../config/client";
import { klerosAddress } from "../config/contracts";
import { validateChainId } from "../utils/validate";
import { datalake } from "../config/supabase";
import logtail from "../config/logtail";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const chainIds = [mainnet.id, gnosis.id, sepolia.id];

const chainName = {
  [mainnet.id]: "mainnet",
  [gnosis.id]: "gnosischain",
  [sepolia.id]: "sepolia",
};

interface RequestBody {
  chainId: Supported<typeof chainIds>;
  account: Address;
  signature: Address;
  derived?: Address;
  derivedSignature?: Address;
  justification: {
    disputeID: number;
    appeal: number;
    voteIDs: number[];
    justification: string;
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
      return { headers, statusCode: StatusCodes.NO_CONTENT };

    if (ev.httpMethod !== "POST")
      throw new Error(
        `Invalid request method, expected POST, got ${ev.httpMethod}`
      );
    if (!ev.body) throw new Error("No body provided");

    const {
      chainId: chainIdParam,
      account,
      signature,
      derived,
      derivedSignature,
      justification: justificationObject,
    } = JSON.parse(ev.body) as RequestBody;

    const { appeal, disputeID, voteIDs, justification } = justificationObject;

    const chainId = validateChainId(String(chainIdParam), chainIds);

    if (derived && derivedSignature) {
      const recovered = await recoverMessageAddress({
        message: `Sign this to confirm derived account address ${derived}. This will be used to provide justifications.`,
        signature: derivedSignature,
      });

      console.log(
        { recovered, account },
        `Sign this to confirm derived account address ${derived}. This will be used to provide justifications.`
      );

      if (recovered !== account) throw new Error("Invalid signature");

      const { error } = await datalake
        .from("derived-accounts")
        .upsert([{ account, derived }])
        .select();

      if (error) throw new Error(error.message);
    }

    const recovered = await recoverMessageAddress({
      message: JSON.stringify(justificationObject),
      signature,
    });

    const { data: storedDerivedData } = await datalake
      .from("derived-accounts")
      .select("derived")
      .eq("account", account);

    const storedDerived = storedDerivedData?.[0].derived;

    if (recovered !== account && recovered !== storedDerived)
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

      if (voter !== account || voted)
        throw new Error(
          "Not all of the supplied vote IDs belong to the supplied address and are not cast."
        );
    }

    const { error } = await datalake
      .from(`${chainName[chainId]}-justifications`)
      .upsert([
        {
          id: `${disputeID}-${appeal}-${account}-${voteIDs.toString()}`,
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
      body: JSON.stringify(justificationObject),
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
