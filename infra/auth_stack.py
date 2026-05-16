"""CDK Stack: Expense Tracker — Authentication (Cognito + Google OAuth).

Deploys:
  * Cognito User Pool with Google federated identity provider
  * User Pool Client with authorization_code grant
  * Cognito Hosted UI domain

Google credentials are read from CDK context (cdk.json or -c flags):
  - google_client_id
  - google_client_secret

The stack synthesizes cleanly even without credentials (Google provider is
conditionally created only when both values are supplied).
"""

from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    SecretValue,
    aws_cognito as cognito,
)
from constructs import Construct


class ExpenseTrackerAuthStack(Stack):
    """Cognito User Pool with Google OAuth for the Expense Tracker.

    Parameters
    ----------
    env_name : str
        Environment name ("test" or "prod").
    domain_name : str | None
        The production app domain (e.g. "expense.datastackai.academy").
        Used to build callback/logout URLs. For test, pass None.
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        env_name: str,
        domain_name: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        is_prod = env_name == "prod"
        removal_policy = RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY

        # ---------------------------------------------------------------
        # Read Google credentials from CDK context
        # ---------------------------------------------------------------
        google_client_id = self.node.try_get_context("google_client_id")
        google_client_secret = self.node.try_get_context("google_client_secret")

        has_google_credentials = bool(google_client_id) and bool(google_client_secret)

        # ---------------------------------------------------------------
        # Cognito User Pool
        # ---------------------------------------------------------------
        user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name=f"expense-tracker-users-{env_name}",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            removal_policy=removal_policy,
        )

        # ---------------------------------------------------------------
        # Cognito Hosted UI Domain
        # ---------------------------------------------------------------
        user_pool.add_domain(
            "CognitoDomain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=f"expense-tracker-auth-{env_name}",
            ),
        )

        # ---------------------------------------------------------------
        # Google Identity Provider (conditional — only if credentials exist)
        # ---------------------------------------------------------------
        google_provider = None
        if has_google_credentials:
            google_provider = cognito.UserPoolIdentityProviderGoogle(
                self,
                "GoogleProvider",
                user_pool=user_pool,
                client_id=google_client_id,
                client_secret_value=SecretValue.unsafe_plain_text(
                    google_client_secret
                ),
                scopes=["openid", "email", "profile"],
                attribute_mapping=cognito.AttributeMapping(
                    email=cognito.ProviderAttribute.GOOGLE_EMAIL,
                    fullname=cognito.ProviderAttribute.GOOGLE_NAME,
                    profile_picture=cognito.ProviderAttribute.GOOGLE_PICTURE,
                ),
            )

        # ---------------------------------------------------------------
        # Callback and Logout URLs
        # ---------------------------------------------------------------
        callback_urls = ["http://localhost:5173/"]
        logout_urls = ["http://localhost:5173/"]

        # Add CloudFront URL for test environment
        cloudfront_url = self.node.try_get_context("cloudfront_url")
        if cloudfront_url:
            callback_urls.append(f"{cloudfront_url}/")
            logout_urls.append(f"{cloudfront_url}/")

        if domain_name:
            callback_urls.append(f"https://{domain_name}/")
            logout_urls.append(f"https://{domain_name}/")

        # ---------------------------------------------------------------
        # User Pool Client
        # ---------------------------------------------------------------
        supported_providers = []
        if has_google_credentials:
            supported_providers.append(
                cognito.UserPoolClientIdentityProvider.GOOGLE
            )

        user_pool_client = user_pool.add_client(
            "AppClient",
            user_pool_client_name=f"expense-tracker-app-{env_name}",
            supported_identity_providers=supported_providers
            if supported_providers
            else None,
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=callback_urls,
                logout_urls=logout_urls,
            ),
            generate_secret=False,
        )

        # Ensure the client depends on the Google provider
        if google_provider:
            user_pool_client.node.add_dependency(google_provider)

        # ---------------------------------------------------------------
        # Outputs
        # ---------------------------------------------------------------
        CfnOutput(
            self,
            "UserPoolId",
            value=user_pool.user_pool_id,
            description="Cognito User Pool ID",
        )
        CfnOutput(
            self,
            "UserPoolClientId",
            value=user_pool_client.user_pool_client_id,
            description="Cognito User Pool Client ID (VITE_COGNITO_CLIENT_ID)",
        )
        CfnOutput(
            self,
            "CognitoDomain",
            value=f"expense-tracker-auth-{env_name}.auth.eu-west-1.amazoncognito.com",
            description="Cognito Hosted UI domain (VITE_COGNITO_DOMAIN)",
        )
