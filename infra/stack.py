"""CDK Stack: Household Expense Tracker — production-grade static site.

Deploys an S3 + CloudFront + OAC static site with:
  * HTTPS-only, HSTS, CSP, and friends via Response Headers Policy
  * Access logs bucket with 90-day lifecycle
  * Separate cache behaviors — hashed assets cached hard, index.html and
    manifest.json always revalidated so deploys roll out instantly
  * Optional custom domain with ACM cert + Route53 alias (prod only)

Two stacks:
  * ExpenseTrackerStack-test  — CloudFront URL only, open access
  * ExpenseTrackerStack-prod  — expense.datastackai.academy
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_certificatemanager as acm,
    aws_route53 as route53,
    aws_route53_targets as targets,
)
from constructs import Construct


class ExpenseTrackerStack(Stack):
    """Static-site hosting stack.

    Parameters
    ----------
    env_name : "test" | "prod"
        Drives domain, removal policy, bucket versioning, and log retention.
    domain_name : str | None
        Full hostname to serve from (e.g. ``expense.datastackai.academy``).
        Requires the parent zone (``datastackai.academy``) to already exist in
        Route53 in the same account. When omitted, only the CloudFront URL is
        used.
    parent_zone_name : str | None
        The *parent* hosted zone name (e.g. ``datastackai.academy``) — used
        for the lookup + record. Only required when ``domain_name`` is set.
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        env_name: str,
        domain_name: str | None = None,
        parent_zone_name: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        is_prod = env_name == "prod"
        removal_policy = RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY
        auto_delete = not is_prod

        # ---------------------------------------------------------------
        # S3: private site bucket + access logs bucket
        # ---------------------------------------------------------------
        logs_bucket = s3.Bucket(
            self, "LogsBucket",
            removal_policy=removal_policy,
            auto_delete_objects=auto_delete,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            # CloudFront needs ACL support on the log delivery bucket.
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="ExpireLogs",
                    expiration=Duration.days(90),
                    abort_incomplete_multipart_upload_after=Duration.days(7),
                )
            ],
        )

        site_bucket = s3.Bucket(
            self, "SiteBucket",
            removal_policy=removal_policy,
            auto_delete_objects=auto_delete,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=is_prod,  # prod gets versioning for rollback
            server_access_logs_bucket=logs_bucket,
            server_access_logs_prefix="s3/",
        )

        # ---------------------------------------------------------------
        # CloudFront: Response Headers Policy (security headers)
        # ---------------------------------------------------------------
        # Content-Security-Policy notes
        # - default-src 'self' covers JS/CSS/JSON we ship
        # - 'unsafe-inline' on style-src is required because Tailwind injects
        #   runtime-computed CSS custom properties; script-src has no inline
        # - connect-src allows API Gateway and Cognito domain (placeholders
        #   until auth/api stacks are deployed)
        csp = "; ".join([
            "default-src 'self'",
            "script-src 'self' https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://www.google-analytics.com https://*.googleusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.execute-api.eu-west-1.amazonaws.com https://expense-tracker-auth-test.auth.eu-west-1.amazoncognito.com https://expense-tracker-auth-prod.auth.eu-west-1.amazoncognito.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://expense-tracker-auth-test.auth.eu-west-1.amazoncognito.com https://expense-tracker-auth-prod.auth.eu-west-1.amazoncognito.com",
        ])

        headers_policy = cloudfront.ResponseHeadersPolicy(
            self, "SecurityHeaders",
            comment=f"Security headers for expense-tracker-{env_name}",
            security_headers_behavior=cloudfront.ResponseSecurityHeadersBehavior(
                strict_transport_security=cloudfront.ResponseHeadersStrictTransportSecurity(
                    access_control_max_age=Duration.days(730),
                    include_subdomains=True,
                    preload=True,
                    override=True,
                ),
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(
                    override=True
                ),
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY,
                    override=True,
                ),
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True,
                ),
                xss_protection=cloudfront.ResponseHeadersXSSProtection(
                    protection=True,
                    mode_block=True,
                    override=True,
                ),
                content_security_policy=cloudfront.ResponseHeadersContentSecurityPolicy(
                    content_security_policy=csp,
                    override=True,
                ),
            ),
        )

        # ---------------------------------------------------------------
        # ACM cert + hosted zone (prod only, when domain configured)
        # ---------------------------------------------------------------
        certificate = None
        hosted_zone = None
        if domain_name and parent_zone_name:
            hosted_zone = route53.HostedZone.from_lookup(
                self, "Zone", domain_name=parent_zone_name
            )
            # CloudFront certs must live in us-east-1. DnsValidatedCertificate
            # handles cross-region under the hood.
            certificate = acm.DnsValidatedCertificate(
                self, "SiteCert",
                domain_name=domain_name,
                hosted_zone=hosted_zone,
                region="us-east-1",
            )

        # ---------------------------------------------------------------
        # CloudFront distribution
        # ---------------------------------------------------------------
        origin = origins.S3BucketOrigin.with_origin_access_control(site_bucket)

        default_behavior = cloudfront.BehaviorOptions(
            origin=origin,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            response_headers_policy=headers_policy,
            compress=True,
        )

        # Entry point + manifest must never be cached by CloudFront — otherwise
        # you'd have to invalidate every deploy. Using CACHING_DISABLED here
        # means CloudFront still terminates TLS and fetches from S3, but
        # doesn't serve stale copies to viewers.
        no_cache_behavior = cloudfront.BehaviorOptions(
            origin=origin,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
            response_headers_policy=headers_policy,
            compress=True,
        )

        additional_behaviors = {
            "/index.html": no_cache_behavior,
            "/manifest.json": no_cache_behavior,
        }

        distribution = cloudfront.Distribution(
            self, "SiteDistribution",
            default_behavior=default_behavior,
            additional_behaviors=additional_behaviors,
            default_root_object="index.html",
            minimum_protocol_version=cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            http_version=cloudfront.HttpVersion.HTTP2_AND_3,
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,  # NA + EU only
            enable_logging=True,
            log_bucket=logs_bucket,
            log_file_prefix="cloudfront/",
            error_responses=[
                # SPA fallback — serve index.html for unknown routes (hash
                # routing means S3 never sees them but we want a safety net)
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
            ],
            domain_names=[domain_name] if domain_name else None,
            certificate=certificate,
            comment=f"expense-tracker-{env_name}",
        )

        # ---------------------------------------------------------------
        # Deploy built site to S3, invalidate on update
        # ---------------------------------------------------------------
        # Strategy: two BucketDeployment constructs with different cache headers.
        #
        # 1. ALL files deployed with long cache (hashed assets benefit).
        #    index.html/manifest.json also get this header initially...
        # 2. ...but the second deployment overwrites just the mutable files
        #    with no-cache headers + triggers CloudFront invalidation.
        #
        # CDK's Source.asset `exclude` uses .dockerignore glob syntax.
        # There's no `include` param, so for the mutable-files deployment we
        # point at a dedicated directory created by the build script.

        # First: deploy everything with immutable caching
        s3deploy.BucketDeployment(
            self, "DeployAllFiles",
            sources=[s3deploy.Source.asset("../frontend/dist")],
            destination_bucket=site_bucket,
            distribution=distribution,
            distribution_paths=["/index.html", "/manifest.json"],
            cache_control=[
                s3deploy.CacheControl.set_public(),
                s3deploy.CacheControl.max_age(Duration.days(365)),
                s3deploy.CacheControl.s_max_age(Duration.days(365)),
            ],
            prune=True,
        )

        # Second: overwrite mutable files with no-cache headers.
        # We point at ../dist-mutable which deploy.sh populates with just
        # index.html and manifest.json.
        s3deploy.BucketDeployment(
            self, "DeployMutableFiles",
            sources=[s3deploy.Source.asset("../dist-mutable")],
            destination_bucket=site_bucket,
            distribution=distribution,
            distribution_paths=["/index.html", "/manifest.json"],
            cache_control=[
                s3deploy.CacheControl.no_cache(),
                s3deploy.CacheControl.no_store(),
                s3deploy.CacheControl.must_revalidate(),
            ],
            prune=False,  # don't remove other files
        )

        # ---------------------------------------------------------------
        # Route53 A record (prod only)
        # ---------------------------------------------------------------
        if hosted_zone and domain_name:
            # Strip the parent zone from the record name: for a zone
            # `datastackai.academy` and domain `expense.datastackai.academy` we
            # want record_name="expense".
            record_name = domain_name
            if parent_zone_name and domain_name.endswith("." + parent_zone_name):
                record_name = domain_name[: -(len(parent_zone_name) + 1)]
            route53.ARecord(
                self, "SiteARecord",
                zone=hosted_zone,
                target=route53.RecordTarget.from_alias(
                    targets.CloudFrontTarget(distribution)
                ),
                record_name=record_name,
            )

        # ---------------------------------------------------------------
        # Outputs — consumed by deploy.sh and for manual operations
        # ---------------------------------------------------------------
        CfnOutput(
            self, "SiteUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="CloudFront default URL",
        )
        if domain_name:
            CfnOutput(
                self, "DomainUrl",
                value=f"https://{domain_name}",
                description="Custom domain URL",
            )
        CfnOutput(
            self, "BucketName",
            value=site_bucket.bucket_name,
            description="Private S3 origin bucket",
        )
        CfnOutput(
            self, "DistributionId",
            value=distribution.distribution_id,
            description="CloudFront distribution ID (for manual invalidation)",
        )
