import fetch, { Blob, FormData } from "node-fetch";

/**
 * Send file to IPFS network via The Graph hosted IPFS node
 * @param data - The raw data from the file to upload.
 * @returns  ipfs response. Should include the hash and path of the stored item.
 */
export const publishToGraph = async (fileName, data) => {
  const url = `${process.env.GRAPH_IPFS_ENDPOINT}/api/v0/add?wrap-with-directory=true`;

  const payload = new FormData();
  payload.append("file", new Blob([data]), fileName);
  console.log("Graph url:", url);

  const response = await fetch(url, {
    method: "POST",
    body: payload,
  });
  console.log("response body:", await response.text(), response.body);

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, Failed to pin to graph`
    );
  }

  const result = parseNewlineSeparatedJSON(await response.text());

  return result.map(({ Name, Hash }) => ({
    hash: Hash,
    path: `/${Name}`,
  }));
};

/**
 * @description parses json from stringified json's seperated by new line
 */
const parseNewlineSeparatedJSON = (text) => {
  const lines = text.trim().split("\n");
  return lines.map((line) => JSON.parse(line));
};

export const areCidsConsistent = (filebaseCid, graphResult) => {
  const graphCid = graphResult[1].hash;
  return graphCid === filebaseCid;
};
