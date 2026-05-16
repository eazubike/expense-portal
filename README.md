# Household Expense Tracker

A mobile-first PWA for tracking weekly household expenses with approval workflows, AI receipt scanning, and spending analytics.

**Live:** https://expense.datastackai.academy

## Features

- **Expense Entry** — Searchable catalog dropdowns with 200+ items across 5+ categories
- **Weekly Grouping** — Navigate between weeks, add expenses to past weeks
- **Approval Workflow** — Draft → Submitted → Approved with role-based access (inputer/approver/admin)
- **AI Receipt Scanning** — Take a photo, Claude extracts items and prices automatically
- **Smart Templates** — Auto-generated from last 3 months of recurring purchases
- **Dashboard** — Year/month/week filters, line chart trends, Pareto category breakdown
- **WhatsApp Share** — Share expense summaries via native share sheet
- **Dynamic Categories** — Admin can add/remove categories from Settings
- **User Management** — Approve/disable/enable users, assign roles
- **PWA** — Installable on mobile with offline support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Query |
| Backend | Node.js 20, AWS Lambda (ESM) |
| Database | DynamoDB (pay-per-request) |
| Auth | Cognito + Google OAuth |
| AI | AWS Bedrock (Claude Haiku 4.5) |
| Hosting | S3 + CloudFront |
| Infra | AWS CDK (Python) |
| API | API Gateway (REST) |

## Project Structure

```
expense-tracker/
├── frontend/          # React PWA (Vite + Tailwind)
│   ├── src/
│   │   ├── api/       # API client functions
│   │   ├── auth/      # Cognito OAuth flow
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom React hooks
│   │   └── utils/     # Helpers (dates, formatting, CSV)
│   └── public/        # Static assets + PWA manifest
├── backend/           # Lambda handlers
│   └── src/
│       ├── handlers/  # expenses, weeks, templates, items, users, scan, settings
│       ├── middleware/ # Auth + role middleware
│       ├── services/  # DynamoDB, S3 clients
│       └── utils/     # Validators, response helpers
├── infra/             # AWS CDK stacks (Python)
│   ├── app.py         # CDK app entry
│   ├── stack.py       # S3 + CloudFront static site
│   ├── api_stack.py   # API Gateway + Lambda + Bedrock
│   ├── database_stack.py  # DynamoDB tables
│   └── auth_stack.py  # Cognito + Google OAuth
├── scripts/           # Data import scripts
└── data/              # Historical data files
```

## Deployment

```bash
# Deploy to test
./deploy.sh test

# Deploy to prod
./deploy.sh prod

# Deploy API only (backend changes)
cd infra && cdk deploy ExpenseTrackerApi-prod --require-approval never
```

## Environment Variables

Frontend (`.env.production`):
```
VITE_COGNITO_DOMAIN=expense-tracker-auth-test.auth.eu-west-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_COGNITO_REDIRECT_URI=https://expense.datastackai.academy/
VITE_API_URL=https://<api-id>.execute-api.eu-west-1.amazonaws.com/prod
```

## Roles

| Role | Permissions |
|------|------------|
| **Inputer** | Add/edit/delete draft expenses, submit for approval |
| **Approver** | Approve/reject submissions, remove submitted items |
| **Admin** | All of the above + manage users, categories, delete any entry |

## Cost

Running cost for a single household (~4 receipts/week):
- DynamoDB: ~$0 (free tier)
- Lambda: ~$0 (free tier)
- CloudFront: ~$0.50/month
- Bedrock (AI scanning): ~$0.05/month
- **Total: < $1/month**
