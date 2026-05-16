# Implementation Tasks

## Phase 1: Project Setup & Infrastructure Foundation

### Task 1: Initialize project structure
- [ ] Create `expense-tracker/` folder with `frontend/`, `backend/`, `infra/` directories
- [ ] Initialize `frontend/` with Vite + React + Tailwind CSS
- [ ] Add PWA support via `vite-plugin-pwa` with manifest and icons
- [ ] Initialize `backend/` with Node.js Lambda handlers structure
- [ ] Create `deploy.sh` script following lituk-practice pattern
- [ ] Create root `package.json` with workspace scripts
- [ ] Create `.gitignore`

**Requirements:** R5 (PWA setup)

### Task 2: CDK infrastructure — static site hosting
- [ ] Create `infra/app.py` with test and prod stack definitions (account `082121306678`, region `eu-west-1`)
- [ ] Create `infra/stack.py` — S3 + CloudFront + OAC static site (following lituk-practice pattern)
- [ ] Test stack: CloudFront URL only, no custom domain, DESTROY removal policy
- [ ] Prod stack: `expense.datastackai.academy`, Route 53 A record, ACM cert in us-east-1, RETAIN policy
- [ ] SPA fallback (404/403 → index.html)
- [ ] Security headers (HSTS, CSP, X-Frame-Options)
- [ ] Separate cache behaviors: hashed assets cached, index.html/manifest no-cache
- [ ] Create `infra/requirements.txt` with CDK dependencies
- [ ] Create `infra/cdk.json`

**Requirements:** R5, R6

### Task 3: CDK infrastructure — DynamoDB tables
- [ ] Create DynamoDB table: `expense-tracker-entries-{stage}` (PK: weekOf, SK: entryId)
- [ ] Create DynamoDB table: `expense-tracker-week-status-{stage}` (PK: weekOf)
- [ ] Create DynamoDB table: `expense-tracker-templates-{stage}` (PK: templateId)
- [ ] Create DynamoDB table: `expense-tracker-custom-items-{stage}` (PK: category, SK: item)
- [ ] Create DynamoDB table: `expense-tracker-users-{stage}` (PK: userId)
- [ ] Create DynamoDB table: `expense-tracker-settings-{stage}` (PK: settingKey)
- [ ] Set on-demand billing mode for all tables
- [ ] Add GSI on users table for email lookup

**Requirements:** R6, R12

### Task 4: CDK infrastructure — Cognito + Google OAuth
- [ ] Create Cognito User Pool with Google as federated identity provider
- [ ] Configure Google OAuth client (callback URLs for test CloudFront + prod domain)
- [ ] Create User Pool Client with OAuth flows
- [ ] Configure Cognito Hosted UI domain
- [ ] Output User Pool ID, Client ID, and domain for frontend env vars

**Requirements:** R12

### Task 5: CDK infrastructure — API Gateway + Lambda
- [ ] Create REST API Gateway with Cognito authorizer
- [ ] Create Lambda functions for: expenses, weeks, templates, items, users, receipts, settings
- [ ] Configure Lambda IAM roles with least-privilege DynamoDB access
- [ ] Create S3 bucket for receipt uploads (`expense-tracker-receipts-{stage}`)
- [ ] Configure CORS on API Gateway for frontend domains
- [ ] Wire up all routes per design doc API endpoints

**Requirements:** R6, R1, R8, R9, R10, R12, R13

---

## Phase 2: Authentication & User Management

### Task 6: Backend — user management Lambda handlers
- [ ] `POST /users/register` — auto-called on first login, creates user with status `awaiting_approval`
- [ ] `GET /users/me` — returns current user profile and status
- [ ] `GET /users` — list all users (admin only)
- [ ] `POST /users/{userId}/approve` — approve pending user with role assignment (admin only)
- [ ] `POST /users/{userId}/reject` — reject pending user (admin only)
- [ ] `PUT /users/{userId}/role` — change user role (admin only)
- [ ] `POST /users/{userId}/revoke` — revoke access (admin only)
- [ ] Auth middleware: extract user from JWT, check approval status on every request
- [ ] Role middleware: check role for protected endpoints

**Requirements:** R12

### Task 7: Frontend — Google Sign-In flow
- [ ] Create `AuthContext.jsx` with Cognito + Google OAuth integration
- [ ] Create `LoginPage.jsx` with Google Sign-In button
- [ ] Create `GoogleCallback.jsx` to handle OAuth redirect
- [ ] Create `PendingApproval.jsx` — "awaiting admin approval" screen
- [ ] Create `ProtectedRoute.jsx` — redirects unauthenticated/unapproved users
- [ ] Store tokens in memory (not localStorage)
- [ ] Auto-refresh tokens before expiry
- [ ] Sign-out: clear all cached data

**Requirements:** R12

### Task 8: Frontend — admin user management panel
- [ ] Create `UserManagement.jsx` in Settings tab (admin only)
- [ ] Display pending users with Approve/Reject buttons
- [ ] Display approved users with role selector and Revoke button
- [ ] Show user's Google name, email, avatar, and last login

**Requirements:** R12

---

## Phase 3: Core Expense CRUD

### Task 9: Backend — expense entry Lambda handlers
- [ ] `POST /expenses` — create new expense entry (validate fields, save to DynamoDB)
- [ ] `GET /expenses?weekOf={date}` — get all entries for a specific week
- [ ] `GET /expenses?from={date}&to={date}` — get entries for date range
- [ ] `PUT /expenses/{weekOf}/{entryId}` — update entry (check week not locked)
- [ ] `DELETE /expenses/{weekOf}/{entryId}` — delete entry (check permissions + week status)
- [ ] `POST /expenses/batch` — create multiple entries (for template apply)
- [ ] Validation: price range, category enum, item length, week status locking
- [ ] Record `createdBy`, `createdByName`, timestamps on create

**Requirements:** R1, R6, R9

### Task 10: Backend — custom items Lambda handlers
- [ ] `GET /items` — return all custom items (merged with built-in catalog on frontend)
- [ ] `POST /items` — add new custom item to category (inputer role)
- [ ] `DELETE /items/{category}/{item}` — remove custom item (admin only)
- [ ] Prevent duplicates (check if item already exists in category)

**Requirements:** R1 (AC 8, 9)

### Task 11: Frontend — item catalog data file
- [ ] Create `src/data/itemCatalog.js` with all 200+ pre-defined items organized by 5 categories
- [ ] Include all items from user's dropdown list (Food, Provision, Others, Mom's Drugs, Dad's Drugs)
- [ ] Export as object with category keys and item arrays

**Requirements:** R1

### Task 12: Frontend — expense entry form
- [ ] Create `ExpenseForm.jsx` with fields: Week Of (date picker), Category (dropdown), Item (searchable), Price (number), Purchase Status (toggle)
- [ ] Category dropdown filters item list on selection
- [ ] Searchable item field with case-insensitive substring matching
- [ ] Bottom sheet pattern for item selector on mobile (large touch targets, search at top)
- [ ] Default Week Of to current week's Sunday
- [ ] Validation: required fields, price format, item length
- [ ] Auto-add custom items to catalog on submit
- [ ] Optimistic UI update on successful save
- [ ] Error handling: retain form data on failure

**Requirements:** R1, R5

### Task 13: Frontend — expense list view
- [ ] Create `ExpenseList.jsx` — displays entries for selected week
- [ ] Create `ExpenseRow.jsx` — single entry with inline edit for price and purchase status
- [ ] Show: item name, category badge, price, purchased checkbox, creator name
- [ ] Running total displayed at bottom/top of list
- [ ] Swipe left to delete (with confirmation)
- [ ] Swipe right to toggle purchased status
- [ ] Receipt indicator icon on entries with attachments
- [ ] Empty state when no entries exist for the week

**Requirements:** R1, R2, R9, R5

### Task 14: Frontend — week navigation
- [ ] Create `WeekSelector.jsx` — shows current week date with prev/next arrows
- [ ] Swipe gesture support for week navigation on mobile
- [ ] Display week date in format "Sunday 22 February 2026"
- [ ] Show weekly total in header
- [ ] Show approval status badge with color coding
- [ ] Sticky header (stays visible while scrolling list)

**Requirements:** R3, R5, R10

---

## Phase 4: Running Total & Calculations

### Task 15: Frontend — running total calculation
- [ ] Create `calculations.js` utility — `calculateRunningTotals(entries)`
- [ ] Sort entries by weekOf then createdAt for cumulative sum
- [ ] Only include entries with purchased=true in running total
- [ ] Memoize calculation with `useMemo` (recalculate only when entries change)
- [ ] Display running total per entry and weekly subtotal

**Requirements:** R2

### Task 16: Frontend — currency formatting
- [ ] Create `formatters.js` — `formatNaira(amount)` returns "₦152,700.00"
- [ ] Use `toLocaleString('en-NG')` with 2 decimal places
- [ ] Create `CurrencyDisplay.jsx` reusable component

**Requirements:** R2 (AC 5)

---

## Phase 5: Approval Workflow

### Task 17: Backend — week status Lambda handlers
- [ ] `GET /weeks` — list all weeks with their status
- [ ] `GET /weeks/{weekOf}` — get single week status (including removal audit)
- [ ] `POST /weeks/{weekOf}/submit` — change status Draft → Submitted (inputer only)
- [ ] `POST /weeks/{weekOf}/approve` — change status Submitted → Approved (approver only)
- [ ] `POST /weeks/{weekOf}/reject` — change status Submitted → Draft (approver only)
- [ ] `POST /weeks/{weekOf}/paid` — change status Approved → Paid (approver only)
- [ ] `POST /weeks/{weekOf}/reconcile` — change status Paid → Reconciled, update purchase statuses (inputer only)
- [ ] `GET /weeks/{weekOf}/removals` — get removal audit trail
- [ ] Validate state transitions (can't skip states)
- [ ] Lock entries when status is Submitted/Approved/Paid/Reconciled

**Requirements:** R10, R14, R15

### Task 18: Frontend — approval status UI
- [ ] Create `ApprovalBanner.jsx` — shows status with color (grey/orange/green/blue/purple)
- [ ] Create `SubmitButton.jsx` — "Submit for Approval" (opens WhatsApp share)
- [ ] Create `ApprovalActions.jsx` — Approve / Request Changes / Mark as Paid buttons (approver only)
- [ ] Create `StatusBadge.jsx` — compact status indicator
- [ ] Disable editing when week is locked (show lock icon + message)
- [ ] Show "Share Approval" button after approver approves

**Requirements:** R10

### Task 19: Frontend — WhatsApp share functionality
- [ ] Create `whatsappShare.js` utility — builds formatted message and opens WhatsApp
- [ ] Submission message: week date, total, itemized list by category, app link
- [ ] Approval message: week date, total, approved by
- [ ] Reconciliation message: items bought vs not bought, final total
- [ ] Removal message: items removed, updated total
- [ ] Use `https://wa.me/?text=...` URL scheme
- [ ] Fallback to Web Share API or clipboard copy
- [ ] Integrate with submit, approve, reconcile, and removal flows

**Requirements:** R11

### Task 20: Frontend — approver item removal
- [ ] When week is "Submitted" and user is approver, show delete button on each entry
- [ ] Confirmation dialog before removal (show item name + price)
- [ ] Call DELETE API, update list and weekly total
- [ ] Create `RemovalAuditTrail.jsx` — shows removed items with who/when
- [ ] "Share Changes" button after removals (opens WhatsApp with removal summary)

**Requirements:** R15

### Task 21: Frontend — reconciliation flow
- [ ] Create `ReconciliationModal.jsx` — full-screen checklist of items from paid week
- [ ] Each item has toggle: Bought ✓ / Not Bought ✗
- [ ] Show running count: "42 of 60 confirmed"
- [ ] "Confirm All" button to mark all as bought (shortcut)
- [ ] Submit reconciliation → updates purchase statuses, moves week to Reconciled
- [ ] "Share Reconciliation" button after completion
- [ ] Gate: block new week entry creation until previous paid week is reconciled

**Requirements:** R14

---

## Phase 6: Templates

### Task 22: Backend — template Lambda handlers
- [ ] `GET /templates` — list all templates
- [ ] `POST /templates` — create template (validate name uniqueness, 1-50 items)
- [ ] `PUT /templates/{templateId}` — update template name/items
- [ ] `DELETE /templates/{templateId}` — delete template
- [ ] Enforce max 20 templates limit

**Requirements:** R8

### Task 23: Frontend — template management
- [ ] Create `TemplateList.jsx` — list saved templates with apply/edit/delete actions
- [ ] Create `TemplateForm.jsx` — create/edit template (name + item list builder)
- [ ] Create `ApplyTemplate.jsx` — preview generated entries, allow edits before confirming
- [ ] "Save current week as template" shortcut from expense list
- [ ] Apply template → batch create entries for current week with purchased=No

**Requirements:** R8

---

## Phase 7: Dashboard & Reports

### Task 24: Frontend — category dashboard
- [ ] Create `Dashboard.jsx` — main dashboard view
- [ ] Create `PeriodFilter.jsx` — weekly / monthly / all-time toggle
- [ ] Create `CategoryBreakdown.jsx` — progress bars per category with amounts and percentages
- [ ] Create `SummaryCards.jsx` — total spent, items bought vs planned, weekly average
- [ ] Fetch data for selected period, calculate summaries
- [ ] Empty state when no data exists
- [ ] Default to monthly view on first load

**Requirements:** R4

### Task 25: Frontend — CSV export
- [ ] Create `csv.js` utility — generates CSV string from entries
- [ ] Include columns: Week Of, Category, Item, Price, Purchase_Status, Running_Total
- [ ] Proper CSV escaping (quotes, commas, newlines)
- [ ] UTF-8 BOM for Excel compatibility
- [ ] Date range selector for export period
- [ ] Trigger browser download with filename including date range
- [ ] Export button in dashboard and settings

**Requirements:** R7

---

## Phase 8: PWA & Mobile Polish

### Task 26: PWA configuration
- [ ] Configure `vite-plugin-pwa` with workbox caching strategies
- [ ] Create `manifest.json` (name, icons, theme color, standalone display)
- [ ] Create app icons (192x192, 512x512, maskable)
- [ ] Service worker: cache app shell (cache-first), API data (network-first), items catalog (stale-while-revalidate)
- [ ] Offline banner component
- [ ] "New version available" update prompt
- [ ] Add to Home Screen prompt on first mobile visit

**Requirements:** R5

### Task 27: Mobile UI polish
- [ ] Create `BottomNav.jsx` — fixed bottom tab bar (Expenses, Dashboard, Templates, Settings)
- [ ] Create `BottomSheet.jsx` — reusable bottom sheet modal for item/category selection
- [ ] Create `PullToRefresh.jsx` — pull-to-refresh wrapper component
- [ ] Implement swipe gestures (week navigation, row actions) via `useSwipe` hook
- [ ] Ensure all tap targets are 48px minimum
- [ ] Ensure all inputs are 16px font (prevent iOS zoom)
- [ ] FAB "Add Expense" button positioned in thumb zone
- [ ] Haptic feedback on purchase toggle (where supported)
- [ ] Auto-focus keyboard on "Add Expense"

**Requirements:** R5

---

## Phase 9: Deploy & Test

### Task 28: Deploy test environment
- [ ] Run `deploy.sh test` — deploy CDK stacks + frontend to CloudFront
- [ ] Verify: app loads, Google sign-in works, expense CRUD works
- [ ] Verify: PWA installable, offline mode shows cached data
- [ ] Verify: mobile layout, bottom nav, swipe gestures
- [ ] Verify: approval workflow end-to-end
- [ ] Verify: WhatsApp share opens with correct message

**Requirements:** All

### Task 29: Deploy production environment
- [ ] Run `deploy.sh prod` — deploy to `expense.datastackai.academy`
- [ ] Verify DNS resolution and SSL certificate
- [ ] Verify Google OAuth callback works with prod domain
- [ ] Smoke test: full workflow (sign in → add expense → submit → approve → reconcile)
- [ ] Set up first admin user (yourself as approver)

**Requirements:** All
