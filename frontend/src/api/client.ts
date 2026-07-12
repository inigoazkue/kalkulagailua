import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default api

export type AccountSubtype = 'daily' | 'savings'
export type BankId = 'caixabank' | 'myinvestor' | 'trade_republic' | 'bit2me'

export interface Account {
  id: number
  name: string
  bank: BankId
  subtype: AccountSubtype
  iban: string | null
  color: string
  include_in_savings: boolean
  show_on_dashboard: boolean
  is_payroll_account: boolean
  current_balance: string | null
  balance_date: string | null
  created_at: string
  last_transaction_date: string | null
}

export interface AccountCreate {
  name: string
  bank: BankId
  subtype: AccountSubtype
  iban?: string
  color?: string
  include_in_savings?: boolean
  show_on_dashboard?: boolean
  is_payroll_account?: boolean
}

export interface AccountUpdate {
  name?: string
  subtype?: AccountSubtype
  iban?: string
  color?: string
  include_in_savings?: boolean
  show_on_dashboard?: boolean
  is_payroll_account?: boolean
}

export interface CategoryKeyword {
  id: number
  keyword: string
}

export interface Category {
  id: number
  name: string
  category_type: 'income' | 'fixed_expense' | 'variable_expense' | 'investment'
  color: string
  is_default: boolean
  keywords: CategoryKeyword[]
}

export interface TransactionCategoryAssignment {
  id: number
  category_id: number
  is_manual: boolean
  category: Category
}

export interface Transaction {
  id: number
  account_id: number
  date: string
  description: string
  amount: string
  balance: string | null
  imported_at: string
  category_assignment: TransactionCategoryAssignment | null
  is_internal_transfer: boolean
  transfer_id: number | null
}

export interface TransactionList {
  items: Transaction[]
  total: number
  page: number
  limit: number
}

export interface TransactionSummary {
  income: string
  fixed_expenses: string
  variable_expenses: string
  investment: string
  savings_transfer: string
  savings: string
}

export interface InvestmentAsset {
  id: number
  ticker: string | null
  name: string
  asset_type: 'stock' | 'etf' | 'fund' | 'crypto'
  isin: string | null
  alias: string | null
  created_at: string
}

export interface AssetPosition {
  asset: InvestmentAsset
  net_invested: string
  current_price: string | null
  current_price_date: string | null
  current_value: string | null
  pnl: string | null
  pnl_pct: string | null
  has_prices: boolean
  sparkline: { date: string; price: string }[]
}

export interface InvestmentPosition {
  asset: InvestmentAsset
  total_quantity: string
  cost_basis: string
  current_price: string
  current_value: string
  pnl: string
  pnl_pct: string
}

export interface IsinLookupResult {
  isin: string
  name: string
  ticker: string | null
  asset_type: string
  found: boolean
}

export interface PortfolioHistoryPoint {
  date: string
  value: string
  contributions: string
}

export interface FundTransfer {
  id: number
  from_asset: { id: number; ticker: string | null; name: string; isin: string | null; alias: string | null }
  to_asset: { id: number; ticker: string | null; name: string; isin: string | null; alias: string | null }
  withdrawal_date: string
  withdrawal_amount: string
  exit_fee: string
  arrival_date: string
  arrival_amount: string
  entry_fee: string
  notes: string | null
  created_at: string
}

export interface ImportResult {
  imported: number
  duplicates: number
  last_transaction_date: string | null
  balance_updated: boolean
}

export interface InternalTransfer {
  id: number
  tx_out_id: number
  tx_in_id: number
  matched_at: string
  is_manual: boolean
  is_validated: boolean
  is_rejected: boolean
  tx_out: Transaction
  tx_in: Transaction
}

export interface TransactionAssetLink {
  id: number
  transaction_id: number
  asset: { id: number; ticker: string | null; name: string; isin: string | null }
  is_auto: boolean
  is_validated: boolean
  is_rejected: boolean
  linked_at: string
}

export interface InvestmentLinkRow {
  transaction: Transaction
  link: TransactionAssetLink | null
}

export const fetchAccounts = () => api.get<Account[]>('/accounts').then(r => r.data)

export const createAccount = (data: AccountCreate) =>
  api.post<Account>('/accounts', data).then(r => r.data)

export const updateAccount = (id: number, data: AccountUpdate) =>
  api.put<Account>(`/accounts/${id}`, data).then(r => r.data)

export const deleteAccount = (id: number) =>
  api.delete(`/accounts/${id}`)

export const fetchCategories = () => api.get<Category[]>('/categories').then(r => r.data)

export const createCategory = (data: { name: string; category_type: string; color: string; keywords: string[] }) =>
  api.post<Category>('/categories', data).then(r => r.data)

export const updateCategory = (id: number, data: Partial<{ name: string; category_type: string; color: string; keywords: string[] }>) =>
  api.put<Category>(`/categories/${id}`, data).then(r => r.data)

export const deleteCategory = (id: number) =>
  api.delete(`/categories/${id}`)

export const fetchTransactions = (params: Record<string, string | number | undefined>) =>
  api.get<TransactionList>('/transactions', { params }).then(r => r.data)

export const fetchSummary = (params: { start?: string; end?: string; account_id?: number; savings_only?: boolean }) =>
  api.get<TransactionSummary>('/transactions/summary', { params }).then(r => r.data)

export const updateAccountBalance = (id: number, data: { balance: number; balance_date: string }) =>
  api.put<Account>(`/accounts/${id}/balance`, data).then(r => r.data)

export const assignCategory = (txId: number, categoryId: number, learn = true) =>
  api.put<Transaction>(`/transactions/${txId}/category${learn ? '' : '?learn=false'}`, { category_id: categoryId }).then(r => r.data)

export const removeCategory = (txId: number) =>
  api.delete<Transaction>(`/transactions/${txId}/category`).then(r => r.data)

export const fetchAssets = () =>
  api.get<InvestmentAsset[]>('/investments/assets').then(r => r.data)

export const createAsset = (data: { ticker: string; asset_type: string }) =>
  api.post<InvestmentAsset>('/investments/assets', data).then(r => r.data)

export const createAssetByIsin = (isin: string, alias?: string) =>
  api.post<InvestmentAsset>('/investments/assets', { isin, alias }).then(r => r.data)

export const updateAsset = (id: number, data: Partial<{ name: string; ticker: string; asset_type: string; isin: string; alias: string }>) =>
  api.put<InvestmentAsset>(`/investments/assets/${id}`, data).then(r => r.data)

export const syncAssetPrices = (id: number) =>
  api.post<{ synced: number }>(`/investments/assets/${id}/sync-prices`).then(r => r.data)

export const lookupIsin = (isin: string) =>
  api.post<IsinLookupResult>('/investments/lookup-isin', { isin }).then(r => r.data)

export const fetchPortfolioHistory = (start?: string, end?: string) =>
  api.get<PortfolioHistoryPoint[]>('/investments/portfolio/history', { params: { start, end } }).then(r => r.data)

export const fetchFundTransfers = () =>
  api.get<FundTransfer[]>('/investments/fund-transfers').then(r => r.data)

export const createFundTransfer = (data: {
  from_asset_id: number; to_asset_id: number
  withdrawal_date: string; withdrawal_amount: number; exit_fee: number
  arrival_date: string; arrival_amount: number; entry_fee: number; notes?: string
}) => api.post<FundTransfer>('/investments/fund-transfers', data).then(r => r.data)

export const updateFundTransfer = (id: number, data: Parameters<typeof createFundTransfer>[0]) =>
  api.put<FundTransfer>(`/investments/fund-transfers/${id}`, data).then(r => r.data)

export const deleteFundTransfer = (id: number) =>
  api.delete(`/investments/fund-transfers/${id}`)

export const fetchPositions = () =>
  api.get<AssetPosition[]>("/investments/positions").then(r => r.data)

export const createInvestmentTransaction = (data: {
  asset_id: number
  account_id: number
  transaction_date: string
  quantity: number
  price_per_unit: number
  fees: number
  transaction_type: string
}) => api.post('/investments/transactions', data).then(r => r.data)

export const fetchPayrollDates = () =>
  api.get<{ dates: string[] }>('/transactions/payroll-dates').then(r => r.data)

export interface AnalyticsDay { date: string; income: number; expenses: number }
export interface AnalyticsCategory { id: number | null; name: string; color: string; category_type: string; total: number }
export interface AnalyticsData {
  daily: AnalyticsDay[]
  categories: AnalyticsCategory[]
  summary: { income: number; fixed_expenses: number; variable_expenses: number; investment: number; savings_transfer: number; net: number }
}

export const fetchAnalyticsData = (params: { start?: string; end?: string; account_id?: number; savings_only?: boolean }) =>
  api.get<AnalyticsData>('/transactions/analytics-data', { params }).then(r => r.data)

export const fetchTransfers = () =>
  api.get<InternalTransfer[]>('/transfers').then(r => r.data)

export const detectTransfers = () =>
  api.post<{ created: number }>('/transfers/detect').then(r => r.data)

export const validateTransfers = (ids: number[], validated: boolean) =>
  api.post<{ updated: number }>('/transfers/validate', { ids, validated }).then(r => r.data)

export const rejectTransfers = (ids: number[], rejected: boolean) =>
  api.post<{ updated: number }>('/transfers/reject', { ids, rejected }).then(r => r.data)

export const resetTransfers = (ids: number[]) =>
  api.post<{ updated: number }>('/transfers/reset', { ids }).then(r => r.data)

export const fetchInvestmentLinks = () =>
  api.get<InvestmentLinkRow[]>('/investments/links').then(r => r.data)

export const createInvestmentLink = (transaction_id: number, asset_id: number) =>
  api.post<TransactionAssetLink>('/investments/links', { transaction_id, asset_id }).then(r => r.data)

export const detectInvestmentLinks = () =>
  api.post<{ created: number }>('/investments/links/detect').then(r => r.data)

export const validateInvestmentLinks = (ids: number[]) =>
  api.post<{ updated: number }>('/investments/links/validate', { ids }).then(r => r.data)

export const rejectInvestmentLinks = (ids: number[]) =>
  api.post<{ updated: number }>('/investments/links/reject', { ids }).then(r => r.data)

export const resetInvestmentLinks = (ids: number[]) =>
  api.post<{ updated: number }>('/investments/links/reset', { ids }).then(r => r.data)

export const deleteInvestmentLink = (id: number) =>
  api.delete(`/investments/links/${id}`)

export const downloadBackup = async () => {
  const res = await api.get('/backup/db', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kalkulagailua_${new Date().toISOString().slice(0, 10)}.sql`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const importFile = (accountId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<ImportResult>(`/imports/${accountId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
