import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as backup from "aws-cdk-lib/aws-backup";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
// Single source of truth for the table layout (shared with the application).
import { TABLE_KEYS } from "../../src/server/db/schema.js";

export interface BasmanStackProps extends StackProps {
  envName: "staging" | "prod";
  alertEmail?: string;
  domain?: string;
  githubRepository?: string;
  githubTokenSecret?: string;
  monthlyBudgetUsd: number;
  sesFromAddress?: string;
  orderNotifyEmail?: string;
}

/**
 * Architecture (deliberately small, serverless, no servers to patch):
 *
 *   Customer ─► Amplify Hosting (Next.js SSR, HTTPS, CDN) ─► DynamoDB (orders, products, sessions)
 *                                                    └────► S3 (product images, private)
 *   Customer ─► CloudFront (images only, OAC) ─► S3
 *
 * No VPC, no database server, no NAT gateway: nearly all cost is per-use.
 */
export class BasmanStack extends Stack {
  constructor(scope: Construct, id: string, props: BasmanStackProps) {
    super(scope, id, props);
    const prod = props.envName === "prod";
    const retain = prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // ── Database ───────────────────────────────────────────────────────────
    const table = new dynamodb.TableV2(this, "Table", {
      tableName: `basman-${props.envName}`,
      partitionKey: { name: TABLE_KEYS.partitionKey, type: dynamodb.AttributeType.STRING },
      sortKey: { name: TABLE_KEYS.sortKey, type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: TABLE_KEYS.ttlAttribute,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true, recoveryPeriodInDays: 35 },
      deletionProtection: prod,
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
      removalPolicy: retain,
      globalSecondaryIndexes: TABLE_KEYS.gsis.map((g) => ({
        indexName: g.name,
        partitionKey: { name: g.partitionKey, type: dynamodb.AttributeType.STRING },
        sortKey: { name: g.sortKey, type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      })),
    });

    // ── Image storage (private bucket, served only via CloudFront) ─────────
    const bucket = new s3.Bucket(this, "Media", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        { noncurrentVersionExpiration: Duration.days(90), abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      removalPolicy: retain,
      autoDeleteObjects: !prod,
    });

    const mediaHeaders = new cloudfront.ResponseHeadersPolicy(this, "MediaHeaders", {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(730), includeSubdomains: true, preload: true, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: "default-src 'none'; sandbox", override: true },
      },
    });

    const cdn = new cloudfront.Distribution(this, "MediaCdn", {
      comment: `Basman ${props.envName} product images`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: mediaHeaders,
        compress: true,
      },
      // PriceClass 200 includes Middle East edge locations, close to customers in Palestine.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // ── Least-privilege role used by the Next.js server on Amplify ─────────
    const computeRole = new iam.Role(this, "AmplifyComputeRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      description: "Runtime permissions for the Basman Next.js server (SSR): DynamoDB table + product images only",
    });
    computeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem",
          "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:ConditionCheckItem",
        ],
        resources: [table.tableArn, `${table.tableArn}/index/*`],
      }),
    );
    // TransactWriteItems is authorised per item action above; no Scan, no table admin.
    bucket.grantPut(computeRole, "products/*");
    bucket.grantDelete(computeRole, "products/*");
    if (props.sesFromAddress) {
      computeRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail"],
          resources: ["*"],
          conditions: { StringEquals: { "ses:FromAddress": props.sesFromAddress } },
        }),
      );
    }

    // ── Amplify Hosting (optional: created when a GitHub repository is given) ──
    const siteUrl = props.domain ? `https://${props.domain}` : undefined;
    let amplifyApp: amplify.CfnApp | undefined;
    if (props.githubRepository && props.githubTokenSecret) {
      const envVars: Record<string, string> = {
        APP_ENV: "production",
        DYNAMODB_TABLE: table.tableName,
        STORAGE_DRIVER: "s3",
        S3_BUCKET: bucket.bucketName,
        MEDIA_BASE_URL: `https://${cdn.distributionDomainName}`,
        NEXT_PUBLIC_MEDIA_BASE_URL: `https://${cdn.distributionDomainName}`,
        TRUST_PROXY: "true",
        PROXY_HOPS: "1",
        ...(siteUrl ? { SITE_URL: siteUrl } : {}),
        ...(props.sesFromAddress ? { SES_FROM_ADDRESS: props.sesFromAddress } : {}),
        ...(props.orderNotifyEmail ? { ORDER_NOTIFY_EMAIL: props.orderNotifyEmail } : {}),
      };
      amplifyApp = new amplify.CfnApp(this, "AmplifyApp", {
        name: `basman-${props.envName}`,
        repository: `https://github.com/${props.githubRepository}`,
        accessToken: SecretValue.secretsManager(props.githubTokenSecret).unsafeUnwrap(),
        platform: "WEB_COMPUTE",
        computeRoleArn: computeRole.roleArn,
        environmentVariables: Object.entries(envVars).map(([name, value]) => ({ name, value })),
        customRules: [{ source: "http://<*>", target: "https://<*>", status: "301" }],
      });
      const branchName = prod ? "main" : "staging";
      new amplify.CfnBranch(this, "AmplifyBranch", {
        appId: amplifyApp.attrAppId,
        branchName,
        stage: prod ? "PRODUCTION" : "BETA",
        framework: "Next.js - SSR",
        enableAutoBuild: true,
        enablePerformanceMode: false,
        // Without a custom domain the site lives at https://<branch>.<app-id>.amplifyapp.com.
        environmentVariables: siteUrl ? [] : [{ name: "SITE_URL", value: `https://${branchName}.${amplifyApp.attrDefaultDomain}` }],
      });
      if (props.domain) {
        new amplify.CfnDomain(this, "AmplifyDomain", {
          appId: amplifyApp.attrAppId,
          domainName: props.domain,
          subDomainSettings: [
            { branchName: "main", prefix: "" },
            { branchName: "main", prefix: "www" },
          ],
          enableAutoSubDomain: false,
        });
      }
    }

    // ── Backups (in addition to 35-day point-in-time recovery) ─────────────
    const plan = new backup.BackupPlan(this, "BackupPlan", {
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: "daily",
          scheduleExpression: events.Schedule.cron({ hour: "1", minute: "0" }),
          deleteAfter: Duration.days(35),
        }),
        new backup.BackupPlanRule({
          ruleName: "monthly",
          scheduleExpression: events.Schedule.cron({ day: "1", hour: "2", minute: "0" }),
          deleteAfter: Duration.days(365),
        }),
      ],
    });
    plan.addSelection("Data", { resources: [backup.BackupResource.fromDynamoDbTable(table)] });

    // ── Monitoring and cost guard-rails ────────────────────────────────────
    const alarms = new sns.Topic(this, "Alarms", { displayName: `Basman ${props.envName} alerts`, enforceSSL: true });
    if (props.alertEmail) alarms.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const notify = new cwActions.SnsAction(alarms);

    const alarm = (id: string, metric: cloudwatch.IMetric, threshold: number, description: string) => {
      const a = new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: description,
      });
      a.addAlarmAction(notify);
    };
    alarm("DdbSystemErrors", table.metricSystemErrorsForOperations({
      period: Duration.minutes(5),
      operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM, dynamodb.Operation.QUERY, dynamodb.Operation.BATCH_GET_ITEM, dynamodb.Operation.TRANSACT_WRITE_ITEMS],
    }), 1, "DynamoDB returned server errors");
    alarm("DdbThrottles", table.metric("ThrottledRequests", { statistic: "Sum", period: Duration.minutes(5) }), 5, "DynamoDB throttled requests");
    alarm("MediaCdn5xx", cdn.metric5xxErrorRate({ period: Duration.minutes(5) }), 5, "Image CDN 5xx error rate above 5%");
    // A sudden flood of order writes usually means abuse that slipped past rate limits.
    alarm("WriteSpike", table.metricConsumedWriteCapacityUnits({ period: Duration.hours(1), statistic: "Sum" }), 50_000, "Unusually high write volume in one hour");

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: `basman-${props.envName}-monthly`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        costFilters: { TagKeyValue: [`user:project$basman-perfumes`] },
      },
      notificationsWithSubscribers: props.alertEmail
        ? [80, 100].map((pct) => ({
            notification: { notificationType: pct === 100 ? "FORECASTED" : "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: pct, thresholdType: "PERCENTAGE" },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail! }],
          }))
        : [],
    });

    // ── Outputs used to configure the app ──────────────────────────────────
    new CfnOutput(this, "DynamoDbTable", { value: table.tableName });
    new CfnOutput(this, "MediaBucket", { value: bucket.bucketName });
    new CfnOutput(this, "MediaBaseUrl", { value: `https://${cdn.distributionDomainName}` });
    new CfnOutput(this, "AmplifyComputeRoleArn", { value: computeRole.roleArn });
    new CfnOutput(this, "AlarmTopicArn", { value: alarms.topicArn });
    if (amplifyApp) new CfnOutput(this, "AmplifyDefaultDomain", { value: amplifyApp.attrDefaultDomain });
  }
}
