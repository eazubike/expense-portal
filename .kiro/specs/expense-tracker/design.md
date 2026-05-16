# Technical Design Document

## Overview

A full-stack household expense tracker built with React (Vite) on the frontend and AWS serverless services on the backend. The system supports multi-user access, weekly expense approval workflows with WhatsApp notifications, receipt uploads, and comprehensive reporting.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + Vite + PWA | Fast dev, installable on mobile, offline support |
| Styling | Tailwind CSS | Rapid UI development, mobile-first utilities |
| State Management | React Query (TanStack Query) | Server state caching, optimistic updates, retry logic |
| Authentication | Amazon Cognito + Google OAuth | Managed auth, Google Sign-In, user pool for approval |
| API | API Gateway (REST) | Serverless, auto-scaling, integrates with Lambda |
| Compute | AWS Lambda (Node.js 20) | Pay-per-use, no server management |
| Database | DynamoDB | Serverless NoSQL, fast reads, pay-per-request |
| File Storage | Amazon S3 | Receipt uploads, presigned URLs |
| Notifications | WhatsApp Share (URL scheme) | No API needed, opens WhatsApp directly on device |
| Infrastructure | AWS CDK (Python) | Infrastructure as code, matches existing projects |
| Hosting | S3 + CloudFront + Route 53 | Custom domain, SSL, global CDN, multi-environment |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              React SPA (S3 + CloudFront)                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │Expenses │ │Dashboard │ │Templates │ │  Settings  │  │   │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │   │
│  │       └────────────┼────────────┼─────────────┘          │   │
│  │                    ▼                                      │   │
│  │           ┌─────────────────┐                            │   │
│  │           │  React Query    │                            │   │
│  │           │  + Auth Context │                            │   │
│  │           └────────┬────────┘                            │   │
│  └────────────────────┼─────────────────────────────────────┘   │
│                       ▼                                          │
│              ┌─────────────────┐                                │
│              │  Amazon Cognito  │ ← JWT Auth                    │
│              └────────┬────────┘                                │
└───────────────────────┼─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│              ┌─────────────────────┐                            │
│              │   API Gateway       │                            │
│              │   (REST API)        │                            │
│              └──────────┬──────────┘                            │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  Expenses  │  │  Templates │  │  Approval  │               │
│  │  Lambda    │  │  Lambda    │  │  Lambda    │               │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘               │
│        │                │               │                       │
│        ▼                ▼               ▼                       │
│  ┌─────────────────────────────────────────────┐               │
│  │              DynamoDB                        │               │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │               │
│  │  │ Expenses │ │Templates │ │  WeekStatus │  │               │
│  │  │  Table   │ │  Table   │ │   Table     │  │               │
│  │  └──────────┘ └──────────┘ └────────────┘  │               │
│  └─────────────────────────────────────────────┘               │
│                                                                  │
│  ┌────────────┐                                                │
│  │  S3 Bucket │                                                │
│  │ (Receipts) │                                                │
│  └────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### DynamoDB Table: Expenses

**Table Name:** `expense-tracker-entries`
**Partition Key:** `weekOf` (String) — ISO date of Sunday (e.g., "2026-02-22")
**Sort Key:** `entryId` (String) — UUID

```typescript
interface ExpenseEntry {
  weekOf: string;           // PK - ISO date of Sunday
  entryId: string;          // SK - UUID v4
  category: Category;
  item: string;             // max 100 chars
  price: number;            // 2 decimal places
  purchased: boolean;       // true = bought
  createdBy: string;        // Cognito user sub
  createdByName: string;    // Display name
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
  receiptKeys?: string[];   // S3 object keys (max 3)
}
```

### DynamoDB Table: WeekStatus

**Table Name:** `expense-tracker-week-status`
**Partition Key:** `weekOf` (String)

```typescript
interface WeekStatus {
  weekOf: string;                    // PK - ISO date of Sunday
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'reconciled';
  submittedAt?: string;              // ISO timestamp
  submittedBy?: string;              // Cognito user sub
  approvedAt?: string;
  approvedBy?: string;
  paidAt?: string;
  reconciledAt?: string;             // When inputer confirmed purchases
  reconciledBy?: string;
  totalSpent: number;                // Cached sum of purchased items
  totalItems: number;                // Total entry count
  itemsBought: number;               // Count of purchased=true
  removals: RemovalRecord[];         // Audit trail of approver removals
}

interface RemovalRecord {
  entryId: string;
  item: string;
  category: string;
  price: number;
  removedBy: string;                 // Approver's user sub
  removedByName: string;             // Approver's display name
  removedAt: string;                 // ISO timestamp
  reason?: string;                   // Optional reason for removal
}
```

### DynamoDB Table: Templates

**Table Name:** `expense-tracker-templates`
**Partition Key:** `templateId` (String) — UUID

```typescript
interface RecurringTemplate {
  templateId: string;       // PK - UUID v4
  name: string;             // 1-50 chars, unique
  items: TemplateItem[];    // 1-50 items
  createdBy: string;        // Cognito user sub
  createdAt: string;
  updatedAt: string;
}

interface TemplateItem {
  category: Category;
  item: string;
  price: number;
}
```

### DynamoDB Table: Settings

**Table Name:** `expense-tracker-settings`
**Partition Key:** `settingKey` (String)

```typescript
interface AppSettings {
  settingKey: string;       // PK - e.g., "whatsapp-config", "budget"
  value: any;               // JSON value
  updatedBy: string;
  updatedAt: string;
}

// WhatsApp config value:
interface WhatsAppConfig {
  enabled: boolean;
  defaultMessage: string;   // Optional custom message prefix
}
```

### Category Enum

```typescript
type Category =
  | "Food"
  | "Provision"
  | "Others"
  | "Mom's Drugs & Hosp. Exp"
  | "Dad's Drugs & Hosp. Exp";
```

### DynamoDB Table: CustomItems

**Table Name:** `expense-tracker-custom-items`
**Partition Key:** `category` (String)
**Sort Key:** `item` (String)

```typescript
interface CustomItem {
  category: Category;       // PK
  item: string;             // SK - item name (max 100 chars)
  addedBy: string;          // Cognito user sub
  addedByName: string;      // Display name
  addedAt: string;          // ISO timestamp
}
```

This table stores user-added items that extend the built-in Item_Catalog. On app load, the frontend merges the built-in catalog with custom items from this table to form the complete dropdown list.

## API Endpoints

### Expenses

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/expenses?weekOf={date}` | Get entries for a week | Required |
| GET | `/expenses?from={date}&to={date}` | Get entries for date range | Required |
| POST | `/expenses` | Create new entry | Inputer |
| PUT | `/expenses/{weekOf}/{entryId}` | Update entry | Inputer |
| DELETE | `/expenses/{weekOf}/{entryId}` | Delete entry | Inputer/Approver |
| POST | `/expenses/batch` | Create multiple entries (template apply) | Inputer |

### Week Status / Approval

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/weeks` | List all weeks with status | Required |
| GET | `/weeks/{weekOf}` | Get week status | Required |
| POST | `/weeks/{weekOf}/submit` | Submit week for approval | Inputer |
| POST | `/weeks/{weekOf}/approve` | Approve submitted week | Approver |
| POST | `/weeks/{weekOf}/reject` | Request changes (back to draft) | Approver |
| POST | `/weeks/{weekOf}/paid` | Mark as paid | Approver |
| POST | `/weeks/{weekOf}/reconcile` | Confirm purchases for closed week | Inputer |
| GET | `/weeks/{weekOf}/removals` | Get audit trail of approver removals | Required |

### Approver Item Removal

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| DELETE | `/expenses/{weekOf}/{entryId}?reason={text}` | Approver removes item from submitted week | Approver |

### Templates

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/templates` | List all templates | Required |
| POST | `/templates` | Create template | Inputer |
| PUT | `/templates/{templateId}` | Update template | Inputer |
| DELETE | `/templates/{templateId}` | Delete template | Inputer |

### Custom Items (Catalog)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/items` | Get all custom items (merged with built-in catalog) | Required |
| POST | `/items` | Add a new custom item to a category | Inputer |
| DELETE | `/items/{category}/{item}` | Remove a custom item | Approver |

### Receipts

**REMOVED** — Receipt uploads are not needed for this use case.

### Settings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/settings` | Get app settings | Admin |
| PUT | `/settings` | Update app settings | Admin |

## Project Structure

```
expense-tracker/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── manifest.json
│   │   └── icons/
│   │       ├── icon-192.png
│   │       ├── icon-512.png
│   │       └── icon-maskable-512.png
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   ├── client.js          # Axios instance with auth headers
│       │   ├── expenses.js        # Expense API calls
│       │   ├── weeks.js           # Week status API calls
│       │   ├── templates.js       # Template API calls
│       │   ├── receipts.js        # Receipt upload/download
│       │   └── settings.js        # Settings API calls
│       ├── auth/
│       │   ├── AuthContext.jsx    # Cognito + Google OAuth context
│       │   ├── GoogleCallback.jsx # OAuth callback handler
│       │   ├── LoginPage.jsx      # Google Sign-In button
│       │   ├── PendingApproval.jsx # "Awaiting approval" screen
│       │   └── ProtectedRoute.jsx # Route guard (checks approved status)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.jsx
│       │   │   ├── BottomNav.jsx       # Fixed bottom tab navigation
│       │   │   ├── BottomSheet.jsx     # Reusable bottom sheet modal
│       │   │   ├── PullToRefresh.jsx   # Pull-to-refresh wrapper
│       │   │   ├── OfflineBanner.jsx   # Offline status indicator
│       │   │   ├── UpdatePrompt.jsx    # "New version available" prompt
│       │   │   └── Toast.jsx
│       │   ├── expenses/
│       │   │   ├── ExpenseForm.jsx
│       │   │   ├── ExpenseList.jsx
│       │   │   ├── ExpenseRow.jsx
│       │   │   ├── WeekSelector.jsx
│       │   │   ├── ApprovalBanner.jsx
│       │   │   ├── ReceiptUpload.jsx
│       │   │   └── SearchableSelect.jsx
│       │   ├── dashboard/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── CategoryBreakdown.jsx
│       │   │   ├── PeriodFilter.jsx
│       │   │   └── SummaryCards.jsx
│       │   ├── templates/
│       │   │   ├── TemplateList.jsx
│       │   │   ├── TemplateForm.jsx
│       │   │   └── ApplyTemplate.jsx
│       │   ├── approval/
│       │   │   ├── SubmitButton.jsx
│       │   │   ├── ApprovalActions.jsx
│       │   │   ├── StatusBadge.jsx
│       │   │   ├── ReconciliationModal.jsx
│       │   │   └── RemovalAuditTrail.jsx
│       │   ├── settings/
│       │   │   ├── SettingsPage.jsx
│       │   │   ├── WhatsAppConfig.jsx
│       │   │   └── UserManagement.jsx  # Admin: approve/reject/revoke users
│       │   └── common/
│       │       ├── ConfirmDialog.jsx
│       │       ├── EmptyState.jsx
│       │       ├── LoadingSpinner.jsx
│       │       └── CurrencyDisplay.jsx
│       ├── data/
│       │   └── itemCatalog.js     # Pre-defined 200+ items
│       ├── hooks/
│       │   ├── useSwipe.js
│       │   ├── useWeekNavigation.js
│       │   ├── useOnlineStatus.js     # Detect online/offline
│       │   ├── usePullToRefresh.js    # Pull-to-refresh gesture
│       │   └── useAuth.js
│       └── utils/
│           ├── dateUtils.js
│           ├── validators.js
│           ├── formatters.js
│           └── csv.js
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── expenses.js       # CRUD for expense entries
│   │   │   ├── weeks.js          # Week status + approval workflow
│   │   │   ├── reconciliation.js # Week closure confirmation
│   │   │   ├── templates.js      # Template CRUD
│   │   │   ├── receipts.js       # Presigned URL generation
│   │   │   └── settings.js       # App settings
│   │   ├── services/
│   │   │   ├── dynamodb.js       # DynamoDB client helpers
│   │   │   ├── whatsapp.js       # Twilio WhatsApp integration
│   │   │   ├── s3.js             # S3 operations
│   │   │   └── auth.js           # Token validation helpers
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js  # JWT validation
│   │   │   └── roleMiddleware.js  # Role-based access control
│   │   └── utils/
│   │       ├── validators.js
│   │       └── responses.js      # Standard API response helpers
│   └── tests/
│       └── ...
├── infra/
│   ├── app.py                    # CDK app entry (Python)
│   ├── stack.py                  # S3 + CloudFront static site stack
│   ├── api_stack.py              # API Gateway + Lambda + DynamoDB
│   ├── auth_stack.py             # Cognito + Google OAuth
│   ├── cdk.json
│   ├── cdk.context.json
│   └── requirements.txt          # CDK Python dependencies
├── deploy.sh                     # Build + deploy script (test/prod)
├── README.md
└── package.json                  # Root workspace config
```

## WhatsApp Share Flow

Instead of a server-side Twilio integration, the app uses the device's native WhatsApp sharing via URL schemes. This is zero-cost, requires no API keys, and works instantly.

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  Inputer │────▶│ Frontend      │────▶│ WhatsApp opens   │
│  clicks  │     │ builds message│     │ with pre-filled  │
│ "Share"  │     │ + opens URL   │     │ message          │
└──────────┘     └───────────────┘     └──────────────────┘
```

**Implementation:**

```javascript
function shareToWhatsApp(message) {
  const encoded = encodeURIComponent(message);
  
  // Try WhatsApp URL scheme (works on mobile)
  const whatsappUrl = `https://wa.me/?text=${encoded}`;
  
  // Fallback: Web Share API
  if (navigator.share) {
    navigator.share({ text: message });
  } else {
    window.open(whatsappUrl, '_blank');
  }
}
```

**Submission message format:**
```
📋 *Expense for week of Sunday 22 February 2026*

*Total: ₦166,800.00 (62 items)*

*Food (38 items — ₦98,200.00):*
• Meat — ₦15,000
• Fresh Tomatoes — ₦3,000
• Grounded Pepper — ₦600
...

*Mom's Drugs & Hosp. Exp (14 items — ₦42,100.00):*
• Neurovite Forte — ₦2,575
• Gabapentin — ₦2,800
...

⏳ Waiting for approval and payment

👉 Review: https://expense.datastackai.academy
```

**Approval share message:**
```
✅ *Expense Approved*

Week of: Sunday 22 February 2026
Total: ₦166,800.00
Approved by: [Name]

💰 Ready for payment
```

**Reconciliation share message:**
```
📝 *Week Reconciled*

Week of: Sunday 22 February 2026
Confirmed by: [Name]

✅ Items bought: 56 of 60
❌ Items not bought: 4
💰 Final total: ₦158,200.00

Not purchased:
• Kettle — ₦5,500
• Curtain hanger — ₦2,000
```

**Approver removal share message:**
```
✂️ *Items Removed*

Week of: Sunday 22 February 2026
Removed by: [Name]

❌ Markintosh — ₦6,000
❌ Kettle — ₦5,500

Updated total: ₦155,300.00
```

## Authentication Flow

1. User opens app → redirected to Google Sign-In via Cognito Hosted UI
2. User authenticates with their Google account
3. Cognito exchanges Google token for Cognito JWT (ID token + access token)
4. Backend checks if user exists in the Users table
5. If new user → creates record with status "awaiting_approval", shows pending screen
6. If approved user → grants access, frontend loads expense data
7. All API calls include `Authorization: Bearer <id_token>` header
8. API Gateway validates JWT via Cognito authorizer
9. Lambda middleware checks user's approval status and role before processing requests

**Cognito Configuration:**
- User Pool with Google as a federated identity provider
- Google OAuth client ID/secret configured in Cognito
- Callback URLs: `https://expense.datastackai.academy/callback` (prod), `https://<cloudfront-id>.cloudfront.net/callback` (test)
- No self-registration via email/password — Google only

**User Approval Flow:**
```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  New user│────▶│ Google Sign  │────▶│ Cognito      │────▶│ Lambda   │
│  opens   │     │ In           │     │ issues JWT   │     │ checks   │
│  app     │     └──────────────┘     └──────────────┘     │ Users DB │
└──────────┘                                                └────┬─────┘
                                                                 │
                                              ┌──────────────────┼──────────────┐
                                              ▼                                  ▼
                                    ┌──────────────────┐              ┌──────────────────┐
                                    │ User NOT found   │              │ User found +     │
                                    │ → Create pending │              │ approved         │
                                    │ → Show "awaiting │              │ → Grant access   │
                                    │   approval" page │              └──────────────────┘
                                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ Admin gets       │
                                    │ notification     │
                                    │ → Approves/      │
                                    │   Rejects user   │
                                    └──────────────────┘
```

### DynamoDB Table: Users

**Table Name:** `expense-tracker-users`
**Partition Key:** `userId` (String) — Cognito sub / Google sub

```typescript
interface AppUser {
  userId: string;           // PK - Cognito/Google sub
  email: string;
  displayName: string;
  avatarUrl?: string;       // Google profile picture
  role: 'inputer' | 'approver' | 'admin';
  status: 'awaiting_approval' | 'approved' | 'rejected' | 'revoked';
  approvedBy?: string;      // Admin who approved
  approvedAt?: string;
  createdAt: string;
  lastLoginAt: string;
}
```

### User Management API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/users` | List all users (with status) | Admin |
| GET | `/users/me` | Get current user profile + status | Any authenticated |
| POST | `/users/{userId}/approve` | Approve a pending user | Admin |
| POST | `/users/{userId}/reject` | Reject a pending user | Admin |
| PUT | `/users/{userId}/role` | Change user role | Admin |
| POST | `/users/{userId}/revoke` | Revoke access | Admin |

## Hosting & Environments

### Domain Configuration

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Production | `expense.datastackai.academy` | Live app for daily use |
| Test | CloudFront default URL (e.g., `d1234abcdef.cloudfront.net`) | Testing new features before prod |

**DNS:** Route 53 hosted zone for `datastackai.academy` with A record pointing to the prod CloudFront distribution only.

**SSL:** ACM certificate in us-east-1 for `expense.datastackai.academy` (prod only). Test uses CloudFront's default `*.cloudfront.net` SSL certificate.

### Environment Separation

```
┌─────────────────────────────────────────────────────────┐
│                    TEST ENVIRONMENT                       │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ CloudFront  │  │ API GW   │  │ DynamoDB tables  │   │
│  │ test-expense│  │ /test    │  │ *-test           │   │
│  │ .cloudfront │  │          │  │                  │   │
│  │ .net        │  │          │  │                  │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ S3 (frontend│  │ Lambdas  │  │ S3 (receipts)    │   │
│  │  -test)     │  │ (-test)  │  │ (-test)          │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PROD ENVIRONMENT                       │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ CloudFront  │  │ API GW   │  │ DynamoDB tables  │   │
│  │ expense     │  │ /prod    │  │ *-prod           │   │
│  │ .datastackai│  │          │  │                  │   │
│  │ .academy    │  │          │  │                  │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ S3 (frontend│  │ Lambdas  │  │ S3 (receipts)    │   │
│  │  -prod)     │  │ (-prod)  │  │ (-prod)          │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### CDK Environment Configuration

```python
# infra/app.py
import aws_cdk as cdk
from stack import ExpenseTrackerStack
from api_stack import ExpenseTrackerApiStack
from auth_stack import ExpenseTrackerAuthStack

app = cdk.App()

# Same account/region as lituk-practice and datastack-ai-academy
env = cdk.Environment(account="082121306678", region="eu-west-1")

# --- test stack: CloudFront URL only, no custom domain ----------------------
ExpenseTrackerStack(
    app, "ExpenseTracker-test",
    env=env,
    env_name="test",
    domain_name=None,
    parent_zone_name=None,
)

# --- prod stack: expense.datastackai.academy --------------------------------
ExpenseTrackerStack(
    app, "ExpenseTracker-prod",
    env=env,
    env_name="prod",
    domain_name="expense.datastackai.academy",
    parent_zone_name="datastackai.academy",
    termination_protection=True,
)

# --- API + Auth stack (shared or per-env) -----------------------------------
ExpenseTrackerApiStack(
    app, "ExpenseTrackerApi-prod",
    env=env,
    env_name="prod",
)

ExpenseTrackerAuthStack(
    app, "ExpenseTrackerAuth-prod",
    env=env,
    env_name="prod",
    domain_name="expense.datastackai.academy",
)

app.synth()
```

All resource names are suffixed with the stage (`-test` or `-prod`) to avoid conflicts within the same AWS account.

## Receipt Upload Flow

**REMOVED** — Receipt uploads are not needed for this use case.

## Approval State Machine

```
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
┌─────────┐    ┌──────────┐    ┌──────────┐ │    ┌────────┐    ┌────────────┐
│  Draft  │───▶│Submitted │───▶│ Approved │─┘───▶│  Paid  │───▶│ Reconciled │
└─────────┘    └──────────┘    └──────────┘      └────────┘    └────────────┘
     ▲              │
     │              │ (reject)
     └──────────────┘
```

**State transitions:**
- Draft → Submitted: Inputer clicks "Submit for Approval"
- Submitted → Approved: Approver clicks "Approve" (after optionally removing items)
- Submitted → Draft: Approver clicks "Request Changes"
- Approved → Paid: Approver clicks "Mark as Paid"
- Paid → Reconciled: Inputer confirms all purchases in reconciliation step

**Locking rules:**
- Draft: Inputer can add/edit/delete entries
- Submitted: Inputer cannot edit; Approver can remove items
- Approved: No edits allowed (locked)
- Paid: No edits allowed; inputer must reconcile before starting new week
- Reconciled: Final state, fully locked

**Approver removal during Submitted state:**
- Approver can delete individual items from the submitted list
- Each removal is logged in the `removals` audit trail
- A WhatsApp notification is sent listing removed items
- After removals, approver can Approve (remaining items) or Request Changes

**Reconciliation gate:**
- When inputer tries to create entries for a new week, the system checks if the most recent "Paid" week exists without reconciliation
- If unreconciled, inputer must go through the reconciliation flow first
- Reconciliation = inputer confirms final purchase status of each item (bought vs not bought)
- After reconciliation, a WhatsApp summary is sent and the week moves to "Reconciled"

## Progressive Web App (PWA) Configuration

### Web App Manifest (`public/manifest.json`)

```json
{
  "name": "Household Expense Tracker",
  "short_name": "Expenses",
  "description": "Track weekly household expenses",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#1a7f37",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker Strategy

Using `vite-plugin-pwa` for automatic service worker generation:

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'prompt', // Show update notification
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.execute-api\..*\/expenses/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-expenses', expiration: { maxEntries: 50 } }
          },
          {
            urlPattern: /^https:\/\/.*\.execute-api\..*\/items/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-items', expiration: { maxAgeSeconds: 86400 } }
          }
        ]
      }
    })
  ]
};
```

**Caching strategy:**
- App shell (HTML, CSS, JS): Cache-first (instant load)
- Item catalog: Stale-while-revalidate (fast load, background refresh)
- Expense data: Network-first (always fresh, fallback to cache when offline)
- Receipts/images: Cache-first with network fallback

### Offline Behavior

- Cached expense data displayed in read-only mode
- Offline banner shown at top of screen
- "Add Expense" button disabled with tooltip "You're offline"
- Data syncs automatically when connection is restored

## Mobile-First UI Design

### Layout Pattern

```
┌─────────────────────────┐
│  Status Bar (device)    │
├─────────────────────────┤
│  Week Header + Total    │  ← Sticky top
│  [◀ Sun 22 Feb 2026 ▶] │
│  Total: ₦166,800.00    │
├─────────────────────────┤
│                         │
│  Expense List           │  ← Scrollable, pull-to-refresh
│  ┌───────────────────┐  │
│  │ ✓ Meat    ₦15,000 │  │
│  │ ✓ Rice    ₦8,000  │  │
│  │ ○ Bread   ₦1,500  │  │
│  │ ...               │  │
│  └───────────────────┘  │
│                         │
├─────────────────────────┤
│  [+ Add Expense]        │  ← FAB or bottom action button
├─────────────────────────┤
│ 🏠  📊  📋  ⚙️         │  ← Bottom tab navigation
│ Home Dash Tmpl Settings │
└─────────────────────────┘
```

### Mobile UX Patterns

| Pattern | Implementation |
|---------|---------------|
| Bottom navigation | Fixed bottom tab bar with 4 tabs |
| Floating action button | "Add Expense" button above bottom nav |
| Bottom sheet | Item/category selector opens as bottom sheet modal |
| Swipe actions | Swipe left on expense row to delete, right to toggle purchased |
| Pull to refresh | Pull down on expense list to reload from API |
| Haptic feedback | Vibration on toggle purchased status (where supported) |
| Thumb zone | All primary actions in bottom 60% of screen |
| Large inputs | 48px min height for all form fields |
| Auto-focus | Keyboard opens automatically on "Add Expense" |

### Item Selector (Bottom Sheet)

On mobile, the searchable dropdown opens as a full-height bottom sheet:

```
┌─────────────────────────┐
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  │  ← Drag handle
│  Search items...  🔍    │  ← Search input (auto-focused)
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │ Meat              │  │  ← Large touch targets (48px rows)
│  │ Milk              │  │
│  │ Milo              │  │
│  │ Moimoi            │  │
│  │ Mortar & Pestle   │  │
│  │ ...               │  │
│  └───────────────────┘  │
├─────────────────────────┤
│  [+ Add "Mango" as new] │  ← If typed text not in catalog
└─────────────────────────┘
```

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| API access | Cognito JWT authorizer on all endpoints |
| Role enforcement | Lambda middleware checks user role and approval status |
| Receipt access | Presigned URLs with short expiry (1hr read, 5min write) |
| CORS | API Gateway configured for frontend domain only |
| Input validation | Server-side validation on all Lambda handlers |
| XSS | React's built-in escaping + no dangerouslySetInnerHTML |

## Performance Considerations

- **DynamoDB queries:** Partition by weekOf enables efficient weekly queries without scans
- **React Query caching:** Stale-while-revalidate pattern for fast UI with background refresh
- **Optimistic updates:** UI updates immediately, rolls back on API failure
- **CloudFront CDN:** Static assets cached globally for fast load times
- **Lambda cold starts:** Node.js 20 runtime, keep handlers lean, use provisioned concurrency if needed
- **Receipt thumbnails:** Generate thumbnails on upload via S3 trigger (future enhancement)

## Cost Estimate (Low Usage)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| DynamoDB (on-demand) | ~$1-2 (low read/write volume) |
| Lambda | ~$0 (free tier covers ~1M requests) |
| API Gateway | ~$0-1 |
| S3 (receipts) | ~$0.50 |
| CloudFront | ~$0 (free tier) |
| Cognito | ~$0 (free tier up to 50k MAU) |
| **Total** | **~$1-3/month** |

## Deployment Strategy

1. **Infrastructure:** Deploy via `cdk deploy ExpenseTracker-Test` or `cdk deploy ExpenseTracker-Prod`
2. **Backend:** Lambda code bundled and deployed via CDK (per environment)
3. **Frontend:** Build with Vite (`npm run build:test` or `npm run build:prod`), upload to respective S3 bucket, invalidate CloudFront
4. **Workflow:** Deploy to test first → verify → deploy to prod
5. **Domain:** Route 53 A/AAAA alias records pointing to CloudFront distributions
6. **SSL:** ACM certificates in us-east-1 for `expense.datastackai.academy` and `test-expense.datastackai.academy`

### Deployment Commands
```bash
# Test environment (CloudFront default URL)
./deploy.sh test

# Production environment (expense.datastackai.academy)
./deploy.sh prod

# Diff only (no deploy)
./deploy.sh prod --diff-only
```

## Environment Variables

### Backend (Lambda)
```
STAGE=test|prod
EXPENSES_TABLE_NAME=expense-tracker-entries-{stage}
WEEK_STATUS_TABLE_NAME=expense-tracker-week-status-{stage}
TEMPLATES_TABLE_NAME=expense-tracker-templates-{stage}
SETTINGS_TABLE_NAME=expense-tracker-settings-{stage}
CUSTOM_ITEMS_TABLE_NAME=expense-tracker-custom-items-{stage}
USERS_TABLE_NAME=expense-tracker-users-{stage}
RECEIPTS_BUCKET_NAME=expense-tracker-receipts-{stage}
COGNITO_USER_POOL_ID=<pool-id>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

### Frontend (.env.test)
```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/test
VITE_COGNITO_USER_POOL_ID=<pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_COGNITO_REGION=<region>
VITE_COGNITO_DOMAIN=<cognito-domain>.auth.<region>.amazoncognito.com
VITE_REDIRECT_URI=https://<cloudfront-id>.cloudfront.net/callback
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

### Frontend (.env.production)
```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=<pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_COGNITO_REGION=<region>
VITE_COGNITO_DOMAIN=<cognito-domain>.auth.<region>.amazoncognito.com
VITE_REDIRECT_URI=https://expense.datastackai.academy/callback
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```
