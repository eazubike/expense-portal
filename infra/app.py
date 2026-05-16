#!/usr/bin/env python3
"""CDK app: deploys stacks for Household Expense Tracker.

  * ExpenseTrackerStack-{env}  — S3 + CloudFront static site
  * ExpenseTrackerApi-{env}    — API Gateway + Lambda
  * ExpenseTrackerDB-{env}     — DynamoDB tables
  * ExpenseTrackerAuth-{env}   — Cognito + Google OAuth
"""
import aws_cdk as cdk
from stack import ExpenseTrackerStack
from api_stack import ExpenseTrackerApiStack
from auth_stack import ExpenseTrackerAuthStack
from database_stack import DatabaseStack

app = cdk.App()

# Same account / region as datastack-ai-academy so the parent Route53 zone is
# discoverable via env-based lookup.
env = cdk.Environment(account="082121306678", region="eu-west-1")

# --- test stack: open, no domain --------------------------------------------
ExpenseTrackerStack(
    app, "ExpenseTrackerStack-test",
    env=env,
    env_name="test",
    domain_name=None,
    parent_zone_name=None,
)

# --- prod stack: expense.datastackai.academy --------------------------------
ExpenseTrackerStack(
    app, "ExpenseTrackerStack-prod",
    env=env,
    env_name="prod",
    domain_name="expense.datastackai.academy",
    parent_zone_name="datastackai.academy",
    termination_protection=True,
)

# --- API stacks: API Gateway + Lambda ----------------------------------------
ExpenseTrackerApiStack(
    app, "ExpenseTrackerApi-test",
    env=env,
    env_name="test",
    user_pool_arn="arn:aws:cognito-idp:eu-west-1:082121306678:userpool/eu-west-1_2sUqmUpHu",
)

ExpenseTrackerApiStack(
    app, "ExpenseTrackerApi-prod",
    env=env,
    env_name="prod",
    user_pool_arn="arn:aws:cognito-idp:eu-west-1:082121306678:userpool/eu-west-1_2sUqmUpHu",
)

# --- Database stacks: dedicated DynamoDB tables -----------------------------
DatabaseStack(
    app, "ExpenseTrackerDB-test",
    env=env,
    env_name="test",
)

DatabaseStack(
    app, "ExpenseTrackerDB-prod",
    env=env,
    env_name="prod",
)

# --- Auth stacks: Cognito + Google OAuth ------------------------------------
ExpenseTrackerAuthStack(
    app, "ExpenseTrackerAuth-test",
    env=env,
    env_name="test",
    domain_name=None,
)

ExpenseTrackerAuthStack(
    app, "ExpenseTrackerAuth-prod",
    env=env,
    env_name="prod",
    domain_name="expense.datastackai.academy",
)

app.synth()
