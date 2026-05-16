"""CDK Stack: Household Expense Tracker — DynamoDB tables.

Creates all DynamoDB tables for the expense tracker backend:
  * Entries (expenses)
  * WeekStatus (approval workflow)
  * Templates (recurring expense templates)
  * CustomItems (user-added catalog items)
  * Users (authentication + roles)
  * Settings (app configuration)

Two stacks:
  * ExpenseTrackerDB-test  — DESTROY removal policy
  * ExpenseTrackerDB-prod  — RETAIN removal policy, point-in-time recovery
"""

from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    aws_dynamodb as dynamodb,
)
from constructs import Construct


class DatabaseStack(Stack):
    """DynamoDB tables stack for the expense tracker.

    Parameters
    ----------
    env_name : "test" | "prod"
        Drives table name suffix, removal policy, and point-in-time recovery.
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        env_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        is_prod = env_name == "prod"
        removal_policy = RemovalPolicy.RETAIN if is_prod else RemovalPolicy.DESTROY

        # -------------------------------------------------------------------
        # DynamoDB: Entries (expenses)
        # -------------------------------------------------------------------
        self.entries_table = dynamodb.Table(
            self,
            "EntriesTable",
            table_name=f"expense-tracker-entries-{env_name}",
            partition_key=dynamodb.Attribute(
                name="weekOf", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="entryId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # -------------------------------------------------------------------
        # DynamoDB: WeekStatus (approval workflow)
        # -------------------------------------------------------------------
        self.week_status_table = dynamodb.Table(
            self,
            "WeekStatusTable",
            table_name=f"expense-tracker-week-status-{env_name}",
            partition_key=dynamodb.Attribute(
                name="weekOf", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # -------------------------------------------------------------------
        # DynamoDB: Templates (recurring expense templates)
        # -------------------------------------------------------------------
        self.templates_table = dynamodb.Table(
            self,
            "TemplatesTable",
            table_name=f"expense-tracker-templates-{env_name}",
            partition_key=dynamodb.Attribute(
                name="templateId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # -------------------------------------------------------------------
        # DynamoDB: CustomItems (user-added catalog items)
        # -------------------------------------------------------------------
        self.custom_items_table = dynamodb.Table(
            self,
            "CustomItemsTable",
            table_name=f"expense-tracker-custom-items-{env_name}",
            partition_key=dynamodb.Attribute(
                name="category", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="item", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # -------------------------------------------------------------------
        # DynamoDB: Users (authentication + roles)
        # -------------------------------------------------------------------
        self.users_table = dynamodb.Table(
            self,
            "UsersTable",
            table_name=f"expense-tracker-users-{env_name}",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # GSI for email lookups
        self.users_table.add_global_secondary_index(
            index_name="email-index",
            partition_key=dynamodb.Attribute(
                name="email", type=dynamodb.AttributeType.STRING
            ),
        )

        # -------------------------------------------------------------------
        # DynamoDB: Settings (app configuration)
        # -------------------------------------------------------------------
        self.settings_table = dynamodb.Table(
            self,
            "SettingsTable",
            table_name=f"expense-tracker-settings-{env_name}",
            partition_key=dynamodb.Attribute(
                name="settingKey", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=removal_policy,
        )

        # -------------------------------------------------------------------
        # Outputs — table names for use by Lambda functions
        # -------------------------------------------------------------------
        CfnOutput(
            self, "EntriesTableName",
            value=self.entries_table.table_name,
            description="DynamoDB table name for expense entries",
        )
        CfnOutput(
            self, "WeekStatusTableName",
            value=self.week_status_table.table_name,
            description="DynamoDB table name for week status",
        )
        CfnOutput(
            self, "TemplatesTableName",
            value=self.templates_table.table_name,
            description="DynamoDB table name for templates",
        )
        CfnOutput(
            self, "CustomItemsTableName",
            value=self.custom_items_table.table_name,
            description="DynamoDB table name for custom items",
        )
        CfnOutput(
            self, "UsersTableName",
            value=self.users_table.table_name,
            description="DynamoDB table name for users",
        )
        CfnOutput(
            self, "SettingsTableName",
            value=self.settings_table.table_name,
            description="DynamoDB table name for settings",
        )
