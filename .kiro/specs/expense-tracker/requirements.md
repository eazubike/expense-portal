# Requirements Document

## Introduction

A full-stack household expense tracker web application that replaces a manual Google Sheets workflow for tracking weekly household spending in Nigerian Naira (₦). The application features a React frontend with an AWS serverless backend (API Gateway + Lambda + DynamoDB), providing multi-user support, expense entry with searchable dropdowns, automatic running total calculations, weekly grouping, category-based dashboards, recurring purchase templates, CSV export, receipt uploads, and WhatsApp group notifications for weekly expense approval workflows.

## Glossary

- **Expense_Tracker**: The full-stack household expense tracker web application
- **Expense_Entry**: A single line item representing a purchased or planned item with its category, price, and purchase status
- **Category**: A classification group for expense items (Food, Provision, Others, Mom's Drugs & Hosp. Exp, Dad's Drugs & Hosp. Exp)
- **Item_Catalog**: The pre-defined list of 200+ items available for selection, organized by category
- **Weekly_Group**: A collection of expense entries grouped by the week they belong to, identified by a "Week Of" date
- **Running_Total**: The cumulative sum of all item prices marked as bought, calculated progressively across entries
- **Purchase_Status**: A flag indicating whether an item has been bought (Yes) or not (No)
- **Recurring_Template**: A saved set of expense entries that can be applied repeatedly (e.g., monthly medications, weekly food staples)
- **Dashboard**: The summary view showing spending breakdowns by category and time period
- **CSV_Export**: The functionality to export expense data as a comma-separated values file
- **Approval_Status**: The state of a weekly expense submission (Draft, Submitted, Approved, Paid)
- **WhatsApp_Share**: A feature that opens WhatsApp with a pre-formatted expense summary message using the device's native sharing, requiring no API or server-side integration
- **Inputer**: The user who enters and submits weekly expenses
- **Approver**: The user who reviews and approves/pays submitted weekly expenses
- **Receipt**: ~~A photo or document uploaded as proof of purchase for an expense entry~~ (REMOVED — not needed)
- **Reconciliation**: The process where the inputer confirms which items from a paid week were actually purchased, required before starting a new week
- **Removal_Audit**: A log of items removed by the approver during the review of a submitted week, including who removed them and when

## Requirements

### Requirement 1: Expense Entry

**User Story:** As an inputer, I want to enter expenses with category and item selection, so that I can quickly log purchases without typing item names manually.

#### Acceptance Criteria

1. WHEN the user opens the expense entry form, THE Expense_Tracker SHALL display fields for Week Of date, Category, Item, Price, and Purchase_Status
2. WHEN the user selects a Category, THE Expense_Tracker SHALL filter the Item_Catalog dropdown to show only items belonging to the selected Category
3. WHEN the user types at least 1 character in the Item field, THE Expense_Tracker SHALL filter the Item_Catalog options to match the typed text using case-insensitive substring matching
4. WHEN the user submits an expense entry with a non-empty Category, a non-empty Item (maximum 100 characters), a numeric Price value between 0.01 and 999,999,999.99 with up to 2 decimal places, and a valid Week Of date, THE Expense_Tracker SHALL save the Expense_Entry to the backend database via the API
5. IF the user submits an expense entry with a missing Price value, THEN THE Expense_Tracker SHALL display a validation error message indicating the Price field is required
6. IF the user submits an expense entry with a missing Category value, THEN THE Expense_Tracker SHALL display a validation error message indicating the Category field is required
7. WHEN the user enters a custom item name not in the Item_Catalog, THE Expense_Tracker SHALL accept the custom item up to a maximum of 100 characters and save it as part of the Expense_Entry
8. WHEN the user submits an expense entry with a custom item name not already in the Item_Catalog, THE Expense_Tracker SHALL automatically add that item to the Item_Catalog under the selected Category so it appears in the dropdown for future entries
9. THE Expense_Tracker SHALL persist newly added custom items to the backend so they are available to all users across sessions
10. IF the user submits an expense entry with a Price value that is not a positive number or exceeds 999,999,999.99 or has more than 2 decimal places, THEN THE Expense_Tracker SHALL display a validation error message indicating the accepted Price format
9. IF the Expense_Entry fails to save to the backend, THEN THE Expense_Tracker SHALL display an error message indicating the entry was not saved and SHALL retain the user-entered data in the form fields

### Requirement 2: Running Total Calculation

**User Story:** As a household manager, I want automatic running total calculations, so that I can see cumulative spending without manual computation.

#### Acceptance Criteria

1. WHEN an Expense_Entry is marked with Purchase_Status of Yes, THE Expense_Tracker SHALL include the Price in the Running_Total calculation
2. WHEN an Expense_Entry is marked with Purchase_Status of No, THE Expense_Tracker SHALL exclude the Price from the Running_Total calculation
3. WHEN the Purchase_Status or Price of an Expense_Entry changes, THE Expense_Tracker SHALL recalculate the Running_Total within 500 milliseconds of the API response
4. THE Expense_Tracker SHALL display the Running_Total as a cumulative sum ordered by entry date, using entry creation order as the tie-breaker for entries sharing the same date, and SHALL display ₦0.00 when no entries have a Purchase_Status of Yes
5. THE Expense_Tracker SHALL format all monetary values in Nigerian Naira (₦) with comma-separated thousands and exactly 2 decimal places

### Requirement 3: Weekly Grouping

**User Story:** As a household manager, I want expenses grouped by week, so that I can review spending on a weekly basis matching my current workflow.

#### Acceptance Criteria

1. THE Expense_Tracker SHALL group all Expense_Entry records by their Week Of date, where a week is defined as starting on Sunday and ending on Saturday
2. WHEN displaying expense entries, THE Expense_Tracker SHALL show entries organized under their respective Weekly_Group headers, with weekly groups sorted in reverse chronological order (most recent week first) and entries within each group sorted by creation date descending
3. WHEN the user creates a new expense entry, THE Expense_Tracker SHALL default the Week Of date to the start of the current week (Sunday)
4. THE Expense_Tracker SHALL display the Week Of date in the format "Day DD Month YYYY" (e.g., "Sunday 22 February 2026")
5. WHEN the user navigates between weeks, THE Expense_Tracker SHALL display only the Expense_Entry records belonging to the selected Weekly_Group
6. IF the user selects a Weekly_Group that contains no Expense_Entry records, THEN THE Expense_Tracker SHALL display an empty state message indicating no expenses exist for that week
7. WHEN the user creates or edits an expense entry, THE Expense_Tracker SHALL allow the user to select a Week Of date that corresponds to any valid Sunday date, defaulting to the current week's Sunday

### Requirement 4: Category Dashboard

**User Story:** As a household manager, I want a dashboard showing spending summaries by category, so that I can understand where household money is going.

#### Acceptance Criteria

1. THE Dashboard SHALL display total spending per Category for the selected time period, formatted to 2 decimal places in the household currency
2. THE Dashboard SHALL display the percentage of total spending each Category represents, rounded to 1 decimal place, where all displayed percentages sum to 100%
3. WHEN the user selects a time period filter, THE Dashboard SHALL recalculate summaries where "weekly" means the current calendar week (Sunday to Saturday), "monthly" means the current calendar month, and "all-time" means all recorded expenses
4. THE Dashboard SHALL display a visual breakdown of spending by Category using a chart or progress bars, showing each Category that has at least one expense in the selected period
5. THE Dashboard SHALL display the total number of items bought versus total items planned for the selected period
6. WHEN the Dashboard loads for the first time, THE Dashboard SHALL default the time period filter to "monthly"
7. IF no expenses exist for the selected time period, THEN THE Dashboard SHALL display a message indicating no spending data is available for the selected period and show zero for all totals and percentages

### Requirement 5: Mobile-First PWA Interface

**User Story:** As an inputer, I want to use the app on my phone like a native app, so that I can enter expenses quickly and conveniently without opening a browser.

#### Acceptance Criteria

1. THE Expense_Tracker SHALL be a Progressive Web App (PWA) that can be installed on the user's home screen on both Android and iOS
2. THE Expense_Tracker SHALL display an "Add to Home Screen" prompt on first visit on mobile devices
3. WHEN installed as a PWA, THE Expense_Tracker SHALL launch in standalone mode (no browser chrome/address bar) with a custom splash screen
4. THE Expense_Tracker SHALL provide a web app manifest with app name "Expense Tracker", theme color, icons (192x192 and 512x512), and display mode set to "standalone"
5. THE Expense_Tracker SHALL register a service worker that caches the app shell (HTML, CSS, JS, item catalog) for instant loading on repeat visits
6. WHEN the device is offline, THE Expense_Tracker SHALL display cached data in read-only mode and show a banner indicating offline status
7. THE Expense_Tracker SHALL render all interactive elements as visible and operable without horizontal scrolling on screens with a minimum width of 320 pixels
8. THE Expense_Tracker SHALL use touch-friendly input controls with a minimum tap target size of 48x48 pixels (larger than standard 44px for easier mobile use)
9. THE Expense_Tracker SHALL use a mobile-first single-column layout as the default, with responsive expansion to multi-column on tablets and desktops (breakpoint at 768px)
10. THE Expense_Tracker SHALL support left and right swipe gestures for navigating between Weekly_Groups
11. IF the user swipes to navigate beyond the first or last Weekly_Group, THEN THE Expense_Tracker SHALL remain on the current Weekly_Group and not perform navigation
12. WHEN the searchable dropdown is activated, THE Expense_Tracker SHALL display the dropdown options in a full-screen modal on mobile (bottom sheet pattern) with large touch targets for easy selection
13. THE Expense_Tracker SHALL render all text input fields with a minimum font size of 16 pixels to prevent browser auto-zoom on iOS
14. THE Expense_Tracker SHALL use a bottom navigation bar (tabs) on mobile for quick access to Expenses, Dashboard, Templates, and Settings
15. THE Expense_Tracker SHALL optimize for one-handed phone use by placing primary action buttons (Add Expense, Submit) within thumb reach at the bottom of the screen
16. THE Expense_Tracker SHALL support pull-to-refresh gesture to reload data from the backend
17. WHEN the app is updated, THE Expense_Tracker SHALL notify the user that a new version is available and offer a one-tap update

### Requirement 6: Data Persistence (Backend)

**User Story:** As a household manager, I want my expense data stored securely in the cloud, so that multiple users can access it and data is never lost.

#### Acceptance Criteria

1. WHEN the user adds, edits, or deletes an Expense_Entry, THE Expense_Tracker SHALL persist the change to DynamoDB via the API within 2 seconds
2. WHEN the application loads, THE Expense_Tracker SHALL fetch all expense data from the backend API and display the entries in their correct state
3. IF the API is unavailable, THEN THE Expense_Tracker SHALL display an error message indicating the service is temporarily unavailable and SHALL retry the request up to 3 times with exponential backoff
4. THE Expense_Tracker SHALL store data in DynamoDB with a partition key of weekOf and sort key of entryId for efficient weekly queries
5. THE backend SHALL support concurrent access from multiple users without data loss or corruption
6. THE Expense_Tracker SHALL cache the most recent week's data locally for offline viewing (read-only)

### Requirement 7: CSV Export

**User Story:** As a household manager, I want to export my expense data as CSV, so that I can back up records or share them with family members.

#### Acceptance Criteria

1. WHEN the user triggers the export action with a selected time period, THE Expense_Tracker SHALL generate a CSV file containing all Expense_Entry records whose Week_Of date falls within the selected start and end dates
2. THE CSV_Export SHALL include columns in this order: Week Of, Category, Item, Price, Purchase_Status, Running_Total
3. THE CSV_Export SHALL format the Price and Running_Total columns as numeric values with exactly two decimal places and without currency symbols
4. THE CSV_Export SHALL use UTF-8 encoding to support special characters in item names
5. WHEN the export completes successfully, THE Expense_Tracker SHALL trigger a browser download of the generated CSV file with a filename that includes the selected time period start and end dates
6. THE CSV_Export SHALL include a header row with column names as the first row of the file
7. IF the selected time period contains no Expense_Entry records, THEN THE Expense_Tracker SHALL generate a CSV file containing only the header row
8. THE CSV_Export SHALL use a comma character as the field delimiter and enclose fields containing commas, newlines, or double quotes in double quotes

### Requirement 8: Recurring Purchase Templates

**User Story:** As an inputer, I want to save and apply recurring purchase templates, so that I can quickly add monthly medications and weekly food staples without re-entering them each time.

#### Acceptance Criteria

1. WHEN the user saves a set of expense entries as a Recurring_Template, THE Expense_Tracker SHALL store the template in the backend with a user-provided name of 1 to 50 characters, retaining each item's Category, Item, and Price values
2. IF the user attempts to save a Recurring_Template with a name that already exists, THEN THE Expense_Tracker SHALL display a validation error message indicating the template name must be unique
3. WHEN the user applies a Recurring_Template, THE Expense_Tracker SHALL create new Expense_Entry records for each item in the template with the Week Of date set to the start of the current week and Purchase_Status set to No
4. WHEN the user applies a Recurring_Template, THE Expense_Tracker SHALL display the generated entries in an editable state allowing the user to modify Price, Category, Item, or remove individual entries before confirming the addition to the Weekly_Group
5. THE Expense_Tracker SHALL allow the user to edit a saved Recurring_Template's name and its list of items (add, remove, or update Category, Item, and Price per entry)
6. WHEN the user requests deletion of a Recurring_Template, THE Expense_Tracker SHALL display a confirmation prompt before removing the template from the backend
7. THE Expense_Tracker SHALL support saving a maximum of 20 Recurring_Templates, each containing between 1 and 50 expense items

### Requirement 9: Expense Editing and Deletion

**User Story:** As an inputer, I want to edit or delete expense entries, so that I can correct mistakes or remove items no longer needed.

#### Acceptance Criteria

1. WHEN the user edits an Expense_Entry field and the new value passes validation, THE Expense_Tracker SHALL update the entry in the backend and recalculate the Running_Total within 2 seconds
2. WHEN the user deletes an Expense_Entry, THE Expense_Tracker SHALL remove the entry from the backend and recalculate the Running_Total within 2 seconds
3. WHEN the user requests deletion of an Expense_Entry, THE Expense_Tracker SHALL display a confirmation prompt with options to confirm or cancel the deletion
4. IF the user cancels the deletion confirmation prompt, THEN THE Expense_Tracker SHALL retain the Expense_Entry unchanged and dismiss the prompt
5. THE Expense_Tracker SHALL allow inline editing of Price and Purchase_Status fields directly in the expense list view by selecting the field value
6. IF the user submits an edited Price value that is not a positive number with at most two decimal places, THEN THE Expense_Tracker SHALL reject the edit, display an error message indicating the valid format, and retain the previous value
7. IF the backend is unavailable during an edit or delete operation, THEN THE Expense_Tracker SHALL display an error message indicating the operation failed and retain the entry in its previous state
8. WHEN a Weekly_Group has Approval_Status of "Approved", "Paid", or "Reconciled", THE Expense_Tracker SHALL prevent editing or deletion of entries in that week and display a message indicating the week is locked
9. WHEN a Weekly_Group has Approval_Status of "Submitted", THE Expense_Tracker SHALL allow the approver to remove individual entries (see Requirement 16) but SHALL prevent the inputer from editing or deleting entries

### Requirement 10: Weekly Expense Submission and Approval Workflow

**User Story:** As an inputer, I want to submit a week's expenses for approval, so that the approver knows the expenses are ready for review and payment.

#### Acceptance Criteria

1. WHEN the inputer clicks "Submit for Approval" on a Weekly_Group, THE Expense_Tracker SHALL change the Approval_Status of that Weekly_Group from "Draft" to "Submitted" and open the WhatsApp share dialog with the expense summary
2. THE shared WhatsApp message SHALL contain: "Expense for week of [Week Of date] — ₦[total amount] (X items) — waiting for approval and payment" followed by the itemized list and app link
3. WHEN the approver views a submitted Weekly_Group, THE Expense_Tracker SHALL display "Approve" and "Request Changes" action buttons
4. WHEN the approver clicks "Approve", THE Expense_Tracker SHALL change the Approval_Status to "Approved" and offer a "Share Approval" button to notify via WhatsApp
5. WHEN the approver clicks "Request Changes", THE Expense_Tracker SHALL change the Approval_Status back to "Draft" and allow the inputer to edit entries again
6. THE Expense_Tracker SHALL display the current Approval_Status prominently in the Weekly_Group header with color coding (Draft=grey, Submitted=orange, Approved=green, Paid=blue)
7. WHEN a Weekly_Group has Approval_Status of "Submitted", THE Expense_Tracker SHALL prevent the inputer from adding, editing, or deleting entries in that week until the status returns to "Draft"
8. THE Expense_Tracker SHALL allow the approver to mark an approved week as "Paid" to indicate payment has been made

### Requirement 11: Share Expense to WhatsApp

**User Story:** As an inputer, I want to share a week's expense summary to WhatsApp with one tap, so that the approver can see what needs approval and payment without logging into the app.

#### Acceptance Criteria

1. WHEN the inputer clicks "Share to WhatsApp" on a Weekly_Group, THE Expense_Tracker SHALL open the WhatsApp app (or WhatsApp Web) with a pre-formatted message containing the expense summary
2. THE shared message SHALL include: the week date, total amount, number of items, a list of all items with prices grouped by category, and a link back to the app for the approver to review
3. THE shared message format SHALL be:
   ```
   📋 *Expense for week of [date]*
   
   *Total: ₦[amount] ([X] items)*
   
   *Food:*
   • Meat — ₦15,000
   • Rice — ₦8,000
   ...
   
   *Provision:*
   • Milk — ₦3,200
   ...
   
   👉 Review & approve: [app link]
   ```
4. THE Expense_Tracker SHALL use the WhatsApp URL scheme (`https://wa.me/?text=...` or `whatsapp://send?text=...`) to open WhatsApp with the pre-filled message
5. WHEN the inputer shares the expense, THE Expense_Tracker SHALL also change the Approval_Status of that Weekly_Group from "Draft" to "Submitted"
6. THE Expense_Tracker SHALL allow the inputer to choose whether to share to a specific contact, a group, or just copy the message to clipboard
7. IF the device does not have WhatsApp installed, THEN THE Expense_Tracker SHALL fall back to the device's native share dialog (Web Share API) or copy the message to clipboard

### Requirement 12: Multi-User Authentication

**User Story:** As a household manager, I want family members to sign in with Google and require my approval before they can use the app, so that only authorized people can access our expense data.

#### Acceptance Criteria

1. THE Expense_Tracker SHALL require users to sign in before accessing any expense data
2. THE Expense_Tracker SHALL support sign-in exclusively via Google OAuth (Google Sign-In) through Amazon Cognito identity federation
3. WHEN a new user signs in with Google for the first time, THE Expense_Tracker SHALL create a pending user record with status "awaiting_approval" and display a message indicating their account is pending admin approval
4. WHEN a new user is pending approval, THE Expense_Tracker SHALL NOT allow them to view, create, or modify any expense data
5. THE Expense_Tracker SHALL provide an admin panel where the admin (approver) can view pending users and approve or reject them
6. WHEN the admin approves a user, THE Expense_Tracker SHALL assign them a role ("inputer" or "approver") and grant them access to the application
7. WHEN a user creates an Expense_Entry, THE Expense_Tracker SHALL record the user's Google display name and email as the creator of that entry
8. THE Expense_Tracker SHALL support two roles: "inputer" (can add/edit/submit expenses) and "approver" (can approve/reject/mark as paid, manage users)
9. THE Expense_Tracker SHALL display the creator's name next to each Expense_Entry in the list view
10. WHEN a user signs out, THE Expense_Tracker SHALL clear all cached data from the browser
11. IF a previously approved user's access is revoked by the admin, THEN THE Expense_Tracker SHALL immediately prevent that user from accessing any data on their next request

### Requirement 13: Receipt Upload

**REMOVED** — Not needed for this use case. The inputer buys household items and doesn't need to attach receipt photos.

### Requirement 14: Week Closure Confirmation (Reconciliation)

**User Story:** As an inputer, I want to confirm that all items from the previous approved week were actually purchased before moving to a new week, so that the expense record accurately reflects what was bought.

#### Acceptance Criteria

1. WHEN the inputer attempts to create a new expense entry for a new Weekly_Group, THE Expense_Tracker SHALL check whether the most recent previously approved week has been reconciled
2. IF the most recent approved week has NOT been reconciled, THEN THE Expense_Tracker SHALL display a reconciliation prompt requiring the inputer to confirm purchases before proceeding
3. THE reconciliation prompt SHALL display all Expense_Entry records from the previous approved week and allow the inputer to mark each item's final Purchase_Status as Yes (bought) or No (not bought)
4. WHEN the inputer completes the reconciliation by confirming all items, THE Expense_Tracker SHALL mark the Weekly_Group as "Reconciled" and update the Purchase_Status of each entry accordingly
5. WHEN a Weekly_Group is marked as "Reconciled", THE Expense_Tracker SHALL recalculate the Running_Total to reflect the final confirmed purchase statuses
6. THE Expense_Tracker SHALL offer a "Share Reconciliation" button after reconciliation that opens WhatsApp with a summary of: items confirmed bought, items not bought, and final total spent for that week
7. IF the inputer marks items as "Not Bought" during reconciliation, THE Expense_Tracker SHALL update the weekly total to exclude those items and display the difference from the originally approved amount
8. THE Expense_Tracker SHALL NOT block the inputer from viewing or navigating to other weeks during reconciliation, only from creating new entries in a new week

### Requirement 15: Approver Item Removal

**User Story:** As an approver, I want to remove items from a submitted expense list, so that I can reject unnecessary purchases before approving the week.

#### Acceptance Criteria

1. WHEN a Weekly_Group has Approval_Status of "Submitted", THE Expense_Tracker SHALL allow the approver to remove individual Expense_Entry records from the list
2. WHEN the approver removes an Expense_Entry, THE Expense_Tracker SHALL delete the entry from the backend and recalculate the weekly total within 2 seconds
3. WHEN the approver removes an Expense_Entry, THE Expense_Tracker SHALL display a confirmation prompt showing the item name and price before deletion
4. THE Expense_Tracker SHALL log which items were removed by the approver, including the approver's name, the item details, and the timestamp of removal
5. WHEN the approver removes one or more items, THE Expense_Tracker SHALL offer a "Share Changes" button that opens WhatsApp with a message listing which items were removed and the updated weekly total
6. THE Expense_Tracker SHALL display a removal history/audit trail showing items the approver removed from a submitted week, visible to both the inputer and approver
7. WHEN the approver has finished reviewing and removing items, THE Expense_Tracker SHALL allow the approver to proceed with "Approve" (approve remaining items) or "Request Changes" (send back to inputer for revision)
