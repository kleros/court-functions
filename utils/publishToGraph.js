import fetch, { Blob, FormData } from "node-fetch";

/**
 * Send file to IPFS network via The Graph hosted IPFS node
 * @param data - The raw data from the file to upload.
 * @returns  ipfs response. Should include the hash and path of the stored item.
 */
export const publishToGraph = async (fileName, data) => {
  const url = `${process.env.GRAPH_IPFS_ENDPOINT}/api/v0/add`;

  const payload = new FormData();
  payload.append("file", new Blob([data]), fileName);

  const response = await fetch(url, {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, Failed to pin to graph`
    );
  }

  const jsonRes = await response.json();

  return jsonRes.Hash;
};
