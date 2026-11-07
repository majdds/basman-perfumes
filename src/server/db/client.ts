import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "../env";

let doc: DynamoDBDocumentClient | null = null;

export function db(): DynamoDBDocumentClient {
  if (doc) return doc;
  const e = env();
  const client = new DynamoDBClient({
    region: e.AWS_REGION,
    ...(e.DYNAMODB_ENDPOINT
      ? { endpoint: e.DYNAMODB_ENDPOINT, credentials: { accessKeyId: "local", secretAccessKey: "local" } }
      : {}),
    maxAttempts: 3,
  });
  doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
  });
  return doc;
}

export function tableName(): string {
  return env().DYNAMODB_TABLE;
}

export function resetDbClient() {
  doc = null;
}
