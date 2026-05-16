import { useState, useCallback, createContext, useContext } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
import OfflineBanner from './components/layout/OfflineBanner'
import UpdatePrompt from './components/layout/UpdatePrompt'
import PullToRefresh from './components/layout/PullToRefresh'
import WeekSelector from './components/expenses/WeekSelector'
import ExpenseList from './components/expenses/ExpenseList'
import ExpenseForm from './components/expenses/ExpenseForm'
import ApprovalBanner from './components/approval/ApprovalBanner'
import RemovalAuditTrail from './components/approval/RemovalAuditTrail'
import Dashboard from './components/dashboard/Dashboard'
import UserManagement from './components/settings/UserManagement'
import CategoryManager from './components/settings/CategoryManager'
import TemplateList from './components/templates/TemplateList'
import TemplateForm from './components/templates/TemplateForm'
import ApplyTemplate from './components/templates/ApplyTemplate'
import SmartTemplates from './components/templates/SmartTemplates'
import ScanReceipt from './components/expenses/ScanReceipt'
import { getExpenses, createExpense, updateExpense, deleteExpense, batchCreateExpenses, addCustomItem, getCustomItems } from './api/expenses'
import { submitWeek, approveWeek, rejectWeek, getWeekStatus } from './api/weeks'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from './api/templates'
import { getWeekStart, toISODate, formatWeekDate } from './utils/dateUtils'
import { calculateRunningTotals } from './utils/calculations'
import { buildRemovalMessage, buildSubmissionMessage, shareToWhatsApp } from './utils/whatsappShare'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Internal context to pass user info from App (which knows about auth mode) to child components
const UserInfoContext = createContext({ userRole: 'inputer', userName: 'User', userAvatar: '' })

function useUserInfo() {
  return useContext(UserInfoContext)
}

function ExpensesTab() {
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)

  const weekOf = toISODate(weekStart)
  const isCurrentWeek = toISODate(getWeekStart(new Date())) === weekOf

  // Get user info from auth context (provided by AppContent wrapper)
  const { userRole, userName, userAvatar } = useUserInfo()

  // Fetch expenses for the current week
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', weekOf],
    queryFn: () => getExpenses(weekOf),
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  // Fetch week status (for removals audit trail)
  const { data: weekStatus } = useQuery({
    queryKey: ['weekStatus', weekOf],
    queryFn: () => getWeekStatus(weekOf),
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  // Fetch custom items (user-added catalog items)
  const { data: customItems = {} } = useQuery({
    queryKey: ['customItems'],
    queryFn: getCustomItems,
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  // Calculate running totals (only purchased items count)
  const expensesWithTotals = calculateRunningTotals(expenses)

  // Calculate weekly total
  const weeklyTotal = expenses.reduce((sum, e) => sum + (e.price || 0), 0)

  // Create expense mutation
  const createMutation = useMutation({
    mutationFn: (entry) => createExpense({ ...entry, weekOf }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
      setShowForm(false)
    },
  })

  // Update expense mutation
  const updateMutation = useMutation({
    mutationFn: ({ weekOf: wk, entryId, updates }) => updateExpense(wk, entryId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
    },
  })

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: ({ weekOf: wk, entryId }) => deleteExpense(wk, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
    },
  })

  // Week action mutations
  const submitMutation = useMutation({
    mutationFn: () => submitWeek(weekOf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
      // Show native share sheet (copy link / share options) without redirecting to WhatsApp
      const weekDate = formatWeekDate(weekStart)
      const appUrl = window.location.origin
      const message = buildSubmissionMessage(weekDate, weeklyTotal, expenses, appUrl)
      if (navigator.share) {
        navigator.share({ text: message }).catch(() => {})
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => approveWeek(weekOf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectWeek(weekOf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
    },
  })

  const handleTogglePurchased = useCallback((wk, entryId, purchased) => {
    updateMutation.mutate({ weekOf: wk, entryId, updates: { purchased } })
  }, [updateMutation])

  const handleUpdatePrice = useCallback((wk, entryId, price) => {
    updateMutation.mutate({ weekOf: wk, entryId, updates: { price } })
  }, [updateMutation])

  const handleUpdateEntry = useCallback((wk, entryId, updates) => {
    updateMutation.mutate({ weekOf: wk, entryId, updates })
  }, [updateMutation])

  const handleDelete = useCallback((wk, entryId) => {
    deleteMutation.mutate({ weekOf: wk, entryId })
  }, [deleteMutation])

  const handleBulkDelete = useCallback(async (entries) => {
    // Delete one at a time sequentially to avoid any race conditions
    for (const { weekOf: wk, entryId } of entries) {
      try {
        await deleteExpense(wk, entryId)
      } catch (e) {
        console.error('Failed to delete:', entryId, e)
      }
    }
    qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
  }, [qc, weekOf])

  const handleRemove = useCallback((entry) => {
    // Approver removal — same as delete but for submitted items
    deleteMutation.mutate({ weekOf: entry.weekOf, entryId: entry.entryId })
  }, [deleteMutation])

  const handleSubmit = useCallback(async (entry) => {
    createMutation.mutate(entry)
  }, [createMutation])

  const handleShareRemovals = useCallback(() => {
    const removals = weekStatus?.removals || []
    if (removals.length === 0) return
    const weekDate = formatWeekDate(weekStart)
    const removedTotal = removals.reduce((sum, r) => sum + (r.price || 0), 0)
    const newTotal = weeklyTotal - removedTotal
    const message = buildRemovalMessage(weekDate, removals, newTotal, userName)
    shareToWhatsApp(message)
  }, [weekStatus, weekStart, weeklyTotal, userName])

  // Determine if inputer can add expenses (always allowed for inputer/admin)
  const canAddExpenses = (userRole === 'inputer' || userRole === 'admin')

  const isAnyMutationLoading = submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending

  return (
    <div>
      <WeekSelector
        weekStart={weekStart}
        weeklyTotal={weeklyTotal}
        itemCount={expenses.length}
        userName={userName}
        userAvatar={userAvatar}
        userRole={userRole}
        isCurrentWeek={isCurrentWeek}
        onPrevWeek={() => {
          const prev = new Date(weekStart)
          prev.setDate(prev.getDate() - 7)
          setWeekStart(getWeekStart(prev))
          setShowForm(false)
          setShowScan(false)
        }}
        onNextWeek={() => {
          if (isCurrentWeek) return
          const next = new Date(weekStart)
          next.setDate(next.getDate() + 7)
          setWeekStart(getWeekStart(next))
          setShowForm(false)
          setShowScan(false)
        }}
        onWeekSelect={(weekOf) => {
          const [y, m, d] = weekOf.split('-').map(Number)
          setWeekStart(new Date(y, m - 1, d))
          setShowForm(false)
          setShowScan(false)
        }}
      />

      {/* Approval banner — per-item status summary */}
      <ApprovalBanner
        weekOf={weekOf}
        weekStart={weekStart}
        expenses={expenses}
        weeklyTotal={weeklyTotal}
        userRole={userRole}
        userName={userName}
        onSubmit={() => submitMutation.mutateAsync()}
        onApprove={() => approveMutation.mutateAsync()}
        onReject={() => rejectMutation.mutateAsync()}
        isLoading={isAnyMutationLoading}
      />

      {/* Removal audit trail (shown when there are removals) */}
      <RemovalAuditTrail
        removals={weekStatus?.removals || []}
        onShareChanges={weekStatus?.removals?.length > 0 ? handleShareRemovals : undefined}
      />

      {showForm && canAddExpenses && (
        <ExpenseForm
          onSubmit={handleSubmit}
          customItems={customItems}
          isSubmitting={createMutation.isPending}
        />
      )}

      {showScan && canAddExpenses && (
        <ScanReceipt
          onConfirm={async (items) => {
            const entries = items.map(i => ({ ...i, weekOf }))
            await batchCreateExpenses(entries)
            qc.invalidateQueries({ queryKey: ['expenses', weekOf] })
            setShowScan(false)
          }}
          onCancel={() => setShowScan(false)}
        />
      )}

      <ExpenseList
        expenses={expensesWithTotals}
        isLoading={isLoading}
        userRole={userRole}
        onTogglePurchased={handleTogglePurchased}
        onUpdatePrice={handleUpdatePrice}
        onUpdateEntry={handleUpdateEntry}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRemove={handleRemove}
      />

      {/* Floating buttons */}
      {canAddExpenses && (
        <>
          {/* Scan button */}
          <button
            type="button"
            onClick={() => { setShowScan(!showScan); setShowForm(false) }}
            className="fixed bottom-20 right-20 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none z-30"
            aria-label="Scan receipt"
          >
            <span className="text-lg">📷</span>
          </button>

          {/* Add button */}
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm)
              setShowScan(false)
              if (!showForm) window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="fixed bottom-20 right-4 w-14 h-14 bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-green-800 active:bg-green-900 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 z-30"
            aria-label={showForm ? 'Close form' : 'Add expense'}
          >
            <svg
              className={`w-7 h-7 transition-transform ${showForm ? 'rotate-45' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

function DashboardTab() {
  return <Dashboard />
}

function TemplatesTab() {
  const qc = useQueryClient()
  const [view, setView] = useState('list') // 'list' | 'create' | 'edit' | 'apply'
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [weekStart] = useState(() => getWeekStart(new Date()))
  const weekOf = toISODate(weekStart)

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: getTemplates,
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: (data) => createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setView('list')
    },
  })

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: ({ templateId, data }) => updateTemplate(templateId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setView('list')
      setSelectedTemplate(null)
    },
  })

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (templateId) => deleteTemplate(templateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  // Apply template (batch create expenses)
  const applyMutation = useMutation({
    mutationFn: (entries) => batchCreateExpenses(entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setView('list')
      setSelectedTemplate(null)
    },
  })

  function handleEdit(template) {
    setSelectedTemplate(template)
    setView('edit')
  }

  function handleApply(template) {
    setSelectedTemplate(template)
    setView('apply')
  }

  function handleSave(data) {
    if (view === 'edit' && selectedTemplate) {
      updateMutation.mutate({ templateId: selectedTemplate.templateId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (view === 'create' || view === 'edit') {
    return (
      <TemplateForm
        template={view === 'edit' ? selectedTemplate : null}
        onSave={handleSave}
        onCancel={() => { setView('list'); setSelectedTemplate(null) }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    )
  }

  if (view === 'apply' && selectedTemplate) {
    return (
      <ApplyTemplate
        template={selectedTemplate}
        weekOf={weekOf}
        onConfirm={(entries) => applyMutation.mutate(entries)}
        onCancel={() => { setView('list'); setSelectedTemplate(null) }}
        isApplying={applyMutation.isPending}
      />
    )
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-gray-100">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Templates</h1>
          <p className="text-xs text-gray-500">Recurring expense templates</p>
        </div>
        <button
          type="button"
          onClick={() => setView('create')}
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 transition-colors"
        >
          + New
        </button>
      </div>

      {/* Smart Templates (auto-generated from last 3 months) */}
      <div className="border-b border-gray-200">
        <div className="px-4 py-2 bg-gray-50">
          <p className="text-xs font-medium text-gray-700">⚡ Smart Templates <span className="text-gray-400 font-normal">(last 3 months)</span></p>
        </div>
        <SmartTemplates onApplyItems={async (items) => {
          const entries = items.map(i => ({ ...i, weekOf }))
          await applyMutation.mutateAsync(entries)
        }} />
      </div>

      {/* Manual templates */}
      {templates.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-700">📋 Saved Templates</p>
          </div>
          <TemplateList
            templates={templates}
            isLoading={isLoading}
            onApply={handleApply}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </div>
      )}
    </div>
  )
}

function SettingsTab() {
  const { userRole, userName } = useUserInfo()
  const [openSection, setOpenSection] = useState(null) // 'users' | 'categories' | null

  function toggleSection(section) {
    setOpenSection(openSection === section ? null : section)
  }

  // Sign out handler — works in both dev and auth mode
  function handleSignOut() {
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI

    if (cognitoDomain && clientId && clientId !== 'placeholder') {
      const logoutUrl = new URL(`https://${cognitoDomain}/logout`)
      logoutUrl.searchParams.set('client_id', clientId)
      logoutUrl.searchParams.set('logout_uri', redirectUri)
      window.location.href = logoutUrl.toString()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage your account and users</p>
      </div>

      {/* Current user info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-900">{userName}</p>
        <p className="text-xs text-gray-500 mt-0.5">Role: {userRole}</p>
      </div>

      {/* User management (collapsible, admin/approver only) */}
      {(userRole === 'admin' || userRole === 'approver') && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('users')}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-gray-900">User Management</span>
            <span className="text-gray-400">{openSection === 'users' ? '▾' : '▸'}</span>
          </button>
          {openSection === 'users' && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <UserManagement />
            </div>
          )}
        </div>
      )}

      {/* Category management (collapsible, admin only) */}
      {userRole === 'admin' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('categories')}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-gray-900">Categories</span>
            <span className="text-gray-400">{openSection === 'categories' ? '▾' : '▸'}</span>
          </button>
          {openSection === 'categories' && (
            <div className="border-t border-gray-100">
              <CategoryManager />
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
}

function AppShell() {
  const [activeTab, setActiveTab] = useState('expenses')
  const qc = useQueryClient()

  async function handleRefresh() {
    await qc.invalidateQueries()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-lg mx-auto relative">
      <UpdatePrompt />
      <OfflineBanner />

      <PullToRefresh onRefresh={handleRefresh}>
        <main>
          {activeTab === 'expenses' && <ExpensesTab />}
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'templates' && <TemplatesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </PullToRefresh>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

/**
 * Authenticated wrapper that provides user info from AuthContext.
 */
function AuthenticatedApp() {
  const { user } = useAuth()
  const userInfo = {
    userRole: user?.role || 'inputer',
    userName: user?.displayName || 'User',
    userAvatar: user?.avatarUrl || '',
  }

  return (
    <UserInfoContext.Provider value={userInfo}>
      <AppShell />
    </UserInfoContext.Provider>
  )
}

function App() {
  // DEV MODE: bypass auth when no Cognito is configured
  const isDev = !import.meta.env.VITE_COGNITO_CLIENT_ID || import.meta.env.VITE_COGNITO_CLIENT_ID === 'placeholder'

  if (isDev) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserInfoContext.Provider value={{ userRole: 'inputer', userName: 'User' }}>
          <AppShell />
        </UserInfoContext.Provider>
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute>
          <AuthenticatedApp />
        </ProtectedRoute>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
