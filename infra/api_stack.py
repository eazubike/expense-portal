"""CDK Stack: Household Expense Tracker — API Gateway + Lambda.

Deploys:
  * REST API Gateway with Cognito User Pool authorizer
  * Lambda functions for each handler (expenses, weeks, templates, items,
    users, receipts, settings)
  * S3 bucket for receipt uploads
  * CORS configuration for frontend domains
  * IAM roles with least-privilege DynamoDB + S3 access

Cross-stack references:
  * DynamoDB table names are deterministic (expense-tracker-{table}-{env_name})
  * Cognito User Pool ARN is passed as a constructor parameter
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_apigateway as apigw,
    aws_lambda as _lambda,
    aws_s3 as s3,
    aws_iam as iam,
    aws_cognito as cognito,
)
from constructs import Construct


class ExpenseTrackerApiStack(Stack):
    """API Gateway + Lambda stack for the expense tracker.

    Parameters
    ----------
    env_name : str
        Environment name ("test" or "prod").
    user_pool_arn : str | None
        ARN of the Cognito User Pool for the authorizer. If None, the
        authorizer is created from a deterministic ARN pattern.
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        env_name: str,
        user_pool_arn: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        is_prod = env_name == "prod"

        # -------------------------------------------------------------------
        # Deterministic table names (from DatabaseStack)
        # -------------------------------------------------------------------
        table_names = {
            "ENTRIES_TABLE": f"expense-tracker-entries-{env_name}",
            "WEEK_STATUS_TABLE": f"expense-tracker-week-status-{env_name}",
            "TEMPLATES_TABLE": f"expense-tracker-templates-{env_name}",
            "CUSTOM_ITEMS_TABLE": f"expense-tracker-custom-items-{env_name}",
            "USERS_TABLE": f"expense-tracker-users-{env_name}",
            "SETTINGS_TABLE": f"expense-tracker-settings-{env_name}",
        }

        # -------------------------------------------------------------------
        # S3 Bucket: Receipt uploads
        # -------------------------------------------------------------------
        receipts_bucket = s3.Bucket(
            self,
            "ReceiptsBucket",
            bucket_name=f"datastackai-expense-receipts-{env_name}",
            removal_policy=RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY,
            auto_delete_objects=not is_prod,
            cors=[
                s3.CorsRule(
                    allowed_methods=[
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.DELETE,
                    ],
                    allowed_origins=[
                        "http://localhost:5173",
                        "https://expense.datastackai.academy",
                        "https://*.cloudfront.net",
                    ],
                    allowed_headers=["*"],
                    max_age=3600,
                )
            ],
        )

        # -------------------------------------------------------------------
        # Shared Lambda environment variables
        # -------------------------------------------------------------------
        common_env = {
            "STAGE": env_name,
            "RECEIPTS_BUCKET": receipts_bucket.bucket_name,
            **table_names,
        }

        # -------------------------------------------------------------------
        # Lambda functions
        # -------------------------------------------------------------------
        backend_code = _lambda.Code.from_asset("../backend")

        lambda_defaults = {
            "runtime": _lambda.Runtime.NODEJS_20_X,
            "memory_size": 256,
            "timeout": Duration.seconds(30),
            "environment": common_env,
            "code": backend_code,
        }

        # Expenses Lambda
        expenses_fn = _lambda.Function(
            self, "ExpensesFn",
            function_name=f"expense-tracker-expenses-{env_name}",
            handler="src/handlers/expenses.handler",
            **lambda_defaults,
        )

        # Weeks Lambda
        weeks_fn = _lambda.Function(
            self, "WeeksFn",
            function_name=f"expense-tracker-weeks-{env_name}",
            handler="src/handlers/weeks.handler",
            **lambda_defaults,
        )

        # Templates Lambda
        templates_fn = _lambda.Function(
            self, "TemplatesFn",
            function_name=f"expense-tracker-templates-{env_name}",
            handler="src/handlers/templates.handler",
            **lambda_defaults,
        )

        # Items Lambda
        items_fn = _lambda.Function(
            self, "ItemsFn",
            function_name=f"expense-tracker-items-{env_name}",
            handler="src/handlers/items.handler",
            **lambda_defaults,
        )

        # Users Lambda
        users_fn = _lambda.Function(
            self, "UsersFn",
            function_name=f"expense-tracker-users-{env_name}",
            handler="src/handlers/users.handler",
            **lambda_defaults,
        )

        # Receipts Lambda
        receipts_fn = _lambda.Function(
            self, "ReceiptsFn",
            function_name=f"expense-tracker-receipts-{env_name}",
            handler="src/handlers/receipts.handler",
            **lambda_defaults,
        )

        # Settings Lambda
        settings_fn = _lambda.Function(
            self, "SettingsFn",
            function_name=f"expense-tracker-settings-{env_name}",
            handler="src/handlers/settings.handler",
            **lambda_defaults,
        )

        # Scan Lambda (receipt scanning with Bedrock)
        scan_fn = _lambda.Function(
            self, "ScanFn",
            function_name=f"expense-tracker-scan-{env_name}",
            handler="src/handlers/scan.handler",
            timeout=Duration.seconds(60),  # longer timeout for AI processing
            memory_size=512,
            **{k: v for k, v in lambda_defaults.items() if k not in ['timeout', 'memory_size']},
        )

        # -------------------------------------------------------------------
        # IAM: DynamoDB access (least-privilege)
        # -------------------------------------------------------------------
        all_table_arns = [
            f"arn:aws:dynamodb:{self.region}:{self.account}:table/{name}"
            for name in table_names.values()
        ]
        all_table_index_arns = [
            f"arn:aws:dynamodb:{self.region}:{self.account}:table/{name}/index/*"
            for name in table_names.values()
        ]

        dynamodb_read_write = iam.PolicyStatement(
            actions=[
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
            ],
            resources=all_table_arns + all_table_index_arns,
        )

        # Grant DynamoDB access to all Lambdas
        for fn in [expenses_fn, weeks_fn, templates_fn, items_fn,
                   users_fn, receipts_fn, settings_fn, scan_fn]:
            fn.add_to_role_policy(dynamodb_read_write)

        # Grant S3 access to receipts Lambda
        receipts_bucket.grant_read_write(receipts_fn)

        # Grant Bedrock access to scan Lambda
        scan_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["bedrock:InvokeModel"],
            resources=[
                "arn:aws:bedrock:*::foundation-model/anthropic.*",
                f"arn:aws:bedrock:*:{self.account}:inference-profile/*",
                "arn:aws:bedrock:*:*:inference-profile/*",
            ],
        ))

        # -------------------------------------------------------------------
        # REST API Gateway
        # -------------------------------------------------------------------
        api = apigw.RestApi(
            self,
            "ExpenseTrackerApi",
            rest_api_name=f"expense-tracker-api-{env_name}",
            deploy_options=apigw.StageOptions(stage_name=env_name),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=[
                    "http://localhost:5173",
                    "https://expense.datastackai.academy",
                    "https://d29fnojbqusuhg.cloudfront.net",
                ],
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # -------------------------------------------------------------------
        # Gateway Responses: Add CORS headers to 4xx errors (authorizer rejections)
        # -------------------------------------------------------------------
        api.add_gateway_response(
            "Unauthorized",
            type=apigw.ResponseType.UNAUTHORIZED,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        )
        api.add_gateway_response(
            "AccessDenied",
            type=apigw.ResponseType.ACCESS_DENIED,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            },
        )

        # -------------------------------------------------------------------
        # Cognito Authorizer
        # -------------------------------------------------------------------
        # Import the User Pool from ARN (cross-stack reference)
        if user_pool_arn:
            user_pool = cognito.UserPool.from_user_pool_arn(
                self, "ImportedUserPool", user_pool_arn
            )
        else:
            # Fallback: construct ARN from deterministic pool name pattern
            # This allows synth without the auth stack deployed
            user_pool = cognito.UserPool.from_user_pool_arn(
                self,
                "ImportedUserPool",
                f"arn:aws:cognito-idp:{self.region}:{self.account}:userpool/{self.region}_placeholder",
            )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
            authorizer_name=f"expense-tracker-authorizer-{env_name}",
        )

        auth_kwargs = {
            "authorizer": authorizer,
            "authorization_type": apigw.AuthorizationType.COGNITO,
        }

        # -------------------------------------------------------------------
        # API Routes: /expenses
        # -------------------------------------------------------------------
        expenses_integration = apigw.LambdaIntegration(expenses_fn)
        expenses_resource = api.root.add_resource("expenses")
        expenses_resource.add_method("GET", expenses_integration, **auth_kwargs)
        expenses_resource.add_method("POST", expenses_integration, **auth_kwargs)

        # POST /expenses/batch
        expenses_batch = expenses_resource.add_resource("batch")
        expenses_batch.add_method("POST", expenses_integration, **auth_kwargs)

        # /expenses/{weekOf}/{entryId}
        expenses_week = expenses_resource.add_resource("{weekOf}")
        expenses_entry = expenses_week.add_resource("{entryId}")
        expenses_entry.add_method("PUT", expenses_integration, **auth_kwargs)
        expenses_entry.add_method("DELETE", expenses_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /weeks
        # -------------------------------------------------------------------
        weeks_integration = apigw.LambdaIntegration(weeks_fn)
        weeks_resource = api.root.add_resource("weeks")
        weeks_resource.add_method("GET", weeks_integration, **auth_kwargs)

        # /weeks/{weekOf}
        weeks_week = weeks_resource.add_resource("{weekOf}")
        weeks_week.add_method("GET", weeks_integration, **auth_kwargs)

        # /weeks/{weekOf}/submit, approve, reject, paid, reconcile
        for action in ["submit", "approve", "reject", "paid", "reconcile"]:
            action_resource = weeks_week.add_resource(action)
            action_resource.add_method("POST", weeks_integration, **auth_kwargs)

        # /weeks/{weekOf}/removals
        removals_resource = weeks_week.add_resource("removals")
        removals_resource.add_method("GET", weeks_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /templates
        # -------------------------------------------------------------------
        templates_integration = apigw.LambdaIntegration(templates_fn)
        templates_resource = api.root.add_resource("templates")
        templates_resource.add_method("GET", templates_integration, **auth_kwargs)
        templates_resource.add_method("POST", templates_integration, **auth_kwargs)

        # /templates/{templateId}
        template_item = templates_resource.add_resource("{templateId}")
        template_item.add_method("PUT", templates_integration, **auth_kwargs)
        template_item.add_method("DELETE", templates_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /items
        # -------------------------------------------------------------------
        items_integration = apigw.LambdaIntegration(items_fn)
        items_resource = api.root.add_resource("items")
        items_resource.add_method("GET", items_integration, **auth_kwargs)
        items_resource.add_method("POST", items_integration, **auth_kwargs)

        # /items/{category}/{item}
        items_category = items_resource.add_resource("{category}")
        items_item = items_category.add_resource("{item}")
        items_item.add_method("DELETE", items_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /users
        # -------------------------------------------------------------------
        users_integration = apigw.LambdaIntegration(users_fn)
        users_resource = api.root.add_resource("users")
        users_resource.add_method("GET", users_integration, **auth_kwargs)

        # /users/me
        users_me = users_resource.add_resource("me")
        users_me.add_method("GET", users_integration, **auth_kwargs)

        # /users/{userId}
        users_user = users_resource.add_resource("{userId}")

        # /users/{userId}/approve, reject, revoke
        for action in ["approve", "reject", "revoke"]:
            user_action = users_user.add_resource(action)
            user_action.add_method("POST", users_integration, **auth_kwargs)

        # /users/{userId}/role
        user_role = users_user.add_resource("role")
        user_role.add_method("PUT", users_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /receipts
        # -------------------------------------------------------------------
        receipts_integration = apigw.LambdaIntegration(receipts_fn)
        receipts_resource = api.root.add_resource("receipts")

        # /receipts/upload-url
        receipts_upload = receipts_resource.add_resource("upload-url")
        receipts_upload.add_method("POST", receipts_integration, **auth_kwargs)

        # /receipts/{key}
        receipts_key = receipts_resource.add_resource("{key}")
        receipts_key.add_method("GET", receipts_integration, **auth_kwargs)
        receipts_key.add_method("DELETE", receipts_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /settings
        # -------------------------------------------------------------------
        settings_integration = apigw.LambdaIntegration(settings_fn)
        settings_resource = api.root.add_resource("settings")
        settings_resource.add_method("GET", settings_integration, **auth_kwargs)
        settings_resource.add_method("PUT", settings_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # API Routes: /scan (receipt scanning)
        # -------------------------------------------------------------------
        scan_integration = apigw.LambdaIntegration(scan_fn)
        scan_resource = api.root.add_resource("scan")
        scan_resource.add_method("POST", scan_integration, **auth_kwargs)

        # -------------------------------------------------------------------
        # Outputs
        # -------------------------------------------------------------------
        CfnOutput(
            self, "ApiUrl",
            value=api.url,
            description="API Gateway endpoint URL",
        )
        CfnOutput(
            self, "ReceiptsBucketName",
            value=receipts_bucket.bucket_name,
            description="S3 bucket for receipt uploads",
        )
