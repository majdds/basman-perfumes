#!/usr/bin/env bash
# Deploys (or updates) the AWS infrastructure for one environment.
#   ./scripts/deploy-infra.sh staging alerts@example.com
#   ./scripts/deploy-infra.sh prod    alerts@example.com basman.ps owner/repo basman/github-token
# Requires AWS credentials for the TARGET account (aws sso login / aws configure).
set -euo pipefail
ENV_NAME="${1:?usage: deploy-infra.sh <staging|prod> <alertEmail> [domain] [githubRepo] [githubTokenSecret]}"
ALERT_EMAIL="${2:?alert e-mail required}"
DOMAIN="${3:-}"; REPO="${4:-}"; TOKEN_SECRET="${5:-}"
[[ "$ENV_NAME" == "staging" || "$ENV_NAME" == "prod" ]] || { echo "env must be staging or prod"; exit 1; }

cd "$(dirname "$0")/../infra"
npm ci --no-fund
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "Deploying Basman-$ENV_NAME to account $ACCOUNT in ${AWS_REGION:-eu-central-1}"
read -r -p "Continue? (yes/no) " ok; [[ "$ok" == "yes" ]] || exit 1

ARGS=(-c "alertEmail=$ALERT_EMAIL")
[[ -n "$DOMAIN" ]] && ARGS+=(-c "domain=$DOMAIN")
[[ -n "$REPO" ]] && ARGS+=(-c "githubRepository=$REPO" -c "githubTokenSecret=$TOKEN_SECRET")

npx cdk bootstrap "aws://$ACCOUNT/${AWS_REGION:-eu-central-1}"
npx cdk diff "Basman-$ENV_NAME" "${ARGS[@]}" || true
npx cdk deploy "Basman-$ENV_NAME" "${ARGS[@]}" --require-approval broadening --outputs-file "cdk-outputs-$ENV_NAME.json"
echo "Outputs written to infra/cdk-outputs-$ENV_NAME.json"
