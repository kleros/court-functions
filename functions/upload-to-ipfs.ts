import { File, FilebaseClient } from "@filebase/client";
import { Handler, HandlerEvent } from "@netlify/functions";
import amqp, { Connection } from "amqplib";
import busboy from "busboy";
import { publishToGraph } from "../utils/publishToGraph";
import { StatusCodes } from "http-status-codes";

const { FILEBASE_TOKEN, RABBITMQ_URL } = process.env;
const filebase = new FilebaseClient({ token: FILEBASE_TOKEN ?? "" });

type FormElement =
  | { isFile: true; filename: string; mimeType: string; content: Buffer }
  | { isFile: false; content: string };
type FormData = { [key: string]: FormElement };

const emitRabbitMQLog = async (cid: string, operation: string) => {
  let connection: Connection | undefined;
  try {
    connection = await amqp.connect(RABBITMQ_URL ?? "");
    const channel = await connection.createChannel();

    await channel.assertExchange("ipfs", "topic");
    channel.publish("ipfs", operation, Buffer.from(cid));

    //eslint-disable-next-line no-console
    console.log(`Sent IPFS CID '${cid}' to exchange 'ipfs'`);
  } catch (err) {
    console.warn(err);
  } finally {
    if (typeof connection !== "undefined") await connection.close();
  }
};

const parseMultipart = ({
  headers,
  body,
  isBase64Encoded,
}: Pick<HandlerEvent, "headers" | "body" | "isBase64Encoded">) =>
  new Promise<FormData>((resolve, reject) => {
    const fields: FormData = {};

    const bb = busboy({ headers });

    bb.on("file", (name, file, { filename, mimeType }) =>
      file.on("data", (content) => {
        fields[name] = { isFile: true, filename, mimeType, content };
      })
    )
      .on("field", (name, value) => {
        if (value) fields[name] = { isFile: false, content: value };
      })
      .on("close", () => resolve(fields))
      .on("error", (err) => reject(err));

    bb.write(body, isBase64Encoded ? "base64" : "binary");
    bb.end();
  });

const pinFiles = async (
  data: FormData,
  operation: string,
  pinToGraph: boolean
): Promise<
  [Array<string>, Array<{ filebaseCid: string; graphCid: string }>]
> => {
  const cids = new Array<string>();
  // keep track in case some cids are inconsistent
  const inconsistentCids = new Array<{
    filebaseCid: string;
    graphCid: string;
  }>();

  for (const [_, dataElement] of Object.entries(data)) {
    if (dataElement.isFile) {
      const { filename, mimeType, content } = dataElement;

      const filebaseCid = await filebase.storeBlob(
        new File([content], filename, { type: mimeType })
      );

      if (pinToGraph) {
        const graphCid = await publishToGraph(filename, content);

        if (graphCid !== filebaseCid) {
          console.warn("Inconsistent cids from Filebase and Graph Node :", {
            filebaseCid,
            graphCid,
          });
          inconsistentCids.push({
            filebaseCid,
            graphCid,
          });
        }
      }

      await emitRabbitMQLog(filebaseCid, operation);
      cids.push(`/ipfs/${filebaseCid}`);
    }
  }

  return [cids, inconsistentCids];
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  // for preflight requests
  switch (event.httpMethod) {
    case "OPTIONS":
      return { headers, statusCode: StatusCodes.NO_CONTENT };
    case "POST":
      break;
    default:
      return { statusCode: StatusCodes.METHOD_NOT_ALLOWED, headers };
  }

  const { queryStringParameters } = event;

  if (!queryStringParameters?.operation) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      headers,
      body: JSON.stringify({ message: "Invalid query parameters" }),
    };
  }

  const { operation, pinToGraph } = queryStringParameters;

  try {
    const parsed = await parseMultipart(event);
    const [cids, inconsistentCids] = await pinFiles(
      parsed,
      operation,
      pinToGraph === "true"
    );

    return {
      statusCode: StatusCodes.OK,
      headers,
      body: JSON.stringify({
        message: "File has been stored successfully",
        cids,
        inconsistentCids,
      }),
    };
  } catch (err: any) {
    console.log("Error occured : ", { err: err.message });

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers,
      body: JSON.stringify({ message: err.message }),
    };
  }
};
