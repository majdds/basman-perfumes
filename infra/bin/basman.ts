#!/usr/bin/env node
/**
 * Basman Perfumes — AWS infrastructure.
 *
 * Two fully separated environments, each its own stack (and ideally its own
 * AWS account):
 *   npx cdk deploy Basman-staging -c alertEmail=you@example.com
 *   npx cdk deploy Basman-prod    -c alertEmail=you@example.com -c domain=basman.ps
 *
 * Optional context (-c key=value):
 *   alertEmail        receives alarms and budget warnings (recommended)
 *   domain            custom domain served by Amplify (DNS configured separately)
 *   githubRepository  "owner/repo" to let CDK create the Amplify app and branch
 *   githubTokenSecret Secrets Manager secret name holding a GitHub token for Amplify
 *   monthlyBudgetUsd  budget alarm threshold (default 25)
 *   sesFromAddress    verified SES sender for optional new-order e-mails
 *   orderNotifyEmail  recipient of optional new-order e-mails
 */
import { App } from "aws-cdk-lib";
import { BasmanStack } from "../lib/basman-stack.js";

const app = new App();
const region = app.node.tryGetContext("region") ?? process.env.CDK_DEFAULT_REGION ?? "eu-central-1";
const account = process.env.CDK_DEFAULT_ACCOUNT;

for (const envName of ["staging", "prod"] as const) {
  new BasmanStack(app, `Basman-${envName}`, {
    env: { account, region },
    envName,
    alertEmail: app.node.tryGetContext("alertEmail"),
    domain: envName === "prod" ? app.node.tryGetContext("domain") : undefined,
    githubRepository: app.node.tryGetContext("githubRepository"),
    githubTokenSecret: app.node.tryGetContext("githubTokenSecret"),
    monthlyBudgetUsd: Number(app.node.tryGetContext("monthlyBudgetUsd") ?? 25),
    sesFromAddress: app.node.tryGetContext("sesFromAddress"),
    orderNotifyEmail: app.node.tryGetContext("orderNotifyEmail"),
    description: `Basman Perfumes online store (${envName})`,
    tags: { project: "basman-perfumes", environment: envName },
  });
}
