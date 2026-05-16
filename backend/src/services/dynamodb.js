/**
 * DynamoDB client and helper functions.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const STAGE = process.env.STAGE || 'test'

export const TABLES = {
  entries: `expense-tracker-entries-${STAGE}`,
  weekStatus: `expense-tracker-week-status-${STAGE}`,
  templates: `expense-tracker-templates-${STAGE}`,
  customItems: `expense-tracker-custom-items-${STAGE}`,
  users: `expense-tracker-users-${STAGE}`,
  settings: `expense-tracker-settings-${STAGE}`,
}

export async function getItem(tableName, key) {
  const response = await docClient.send(new GetCommand({ TableName: tableName, Key: key }))
  return response.Item
}

export async function putItem(tableName, item) {
  await docClient.send(new PutCommand({ TableName: tableName, Item: item }))
  return item
}

export async function queryItems(tableName, keyCondition, expressionValues, options = {}) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
    ...options,
  }
  const response = await docClient.send(new QueryCommand(params))
  return response.Items || []
}

export async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }))
}

export async function scanTable(tableName) {
  const response = await docClient.send(new ScanCommand({ TableName: tableName }))
  return response.Items || []
}

export { docClient }
