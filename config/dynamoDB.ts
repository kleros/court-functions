import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const dynamoDB = new DynamoDBClient({
  credentials: {
    accessKeyId: process.env.DDB_ACCESS_KEY,
    secretAccessKey: process.env.DDB_SECRET_KEY,
  },
});
