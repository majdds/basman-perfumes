import { pathToFileURL } from "node:url";
/**
 * Creates the DynamoDB table for LOCAL development / tests.
 * Production tables are created by the CDK stack in infra/ (with
 * point-in-time recovery, deletion protection and encryption).
 *
 *   npm run db:create
 */
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, UpdateTimeToLiveCommand, waitUntilTableExists } from "@aws-sdk/client-dynamodb";
import { TABLE_KEYS } from "../src/server/db/schema";

export async function createTable(tableName: string, endpoint: string | undefined, region = process.env.AWS_REGION ?? "eu-central-1") {
  const client = new DynamoDBClient({
    region,
    ...(endpoint ? { endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
  });
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return false;
  } catch (e) {
    if ((e as { name?: string }).name !== "ResourceNotFoundException") throw e;
  }
  const attrs = new Set<string>([TABLE_KEYS.partitionKey, TABLE_KEYS.sortKey]);
  TABLE_KEYS.gsis.forEach((g) => (attrs.add(g.partitionKey), attrs.add(g.sortKey)));
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [...attrs].map((AttributeName) => ({ AttributeName, AttributeType: "S" })),
      KeySchema: [
        { AttributeName: TABLE_KEYS.partitionKey, KeyType: "HASH" },
        { AttributeName: TABLE_KEYS.sortKey, KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: TABLE_KEYS.gsis.map((g) => ({
        IndexName: g.name,
        KeySchema: [
          { AttributeName: g.partitionKey, KeyType: "HASH" },
          { AttributeName: g.sortKey, KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      })),
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName });
  await client.send(
    new UpdateTimeToLiveCommand({ TableName: tableName, TimeToLiveSpecification: { Enabled: true, AttributeName: TABLE_KEYS.ttlAttribute } }),
  );
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const table = process.env.DYNAMODB_TABLE ?? "basman-dev";
  const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
  if (!endpoint && !process.argv.includes("--aws")) {
    console.error("DYNAMODB_ENDPOINT is not set. Production tables are created by CDK (infra/). Pass --aws to override.");
    process.exit(1);
  }
  createTable(table, endpoint).then((created) => console.log(created ? `Created table ${table}` : `Table ${table} already exists`));
}
