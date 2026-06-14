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
  current_balance: string | null
  balance_date: string | null
  created_at: string
}

export interface AccountCreate {
  name: string
  bank: BankId
  subtype: AccountSubtype
  iban?: string
  color?: string
  include_in_savings?: boolean
  show_on_dashboard?: boolean
}

export interface AccountUpdate {
  name?: string
  subtype?: AccountSubtype
  iban?: string
  color?: string
  include_in_savings?: boolean
  show_on_dashboard?: boolean
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
  savings: string
}

export interface InvestmentAsset {
  id: number
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'fund' | 'crypto'
  created_at: string
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

export interface ImportResult {
  imported: number
  duplicates: number
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

export const fetchSummary = (params: { start?: string; end?: string }) =>
  api.get<TransactionSummary>('/transactions/summary', { params }).then(r => r.data)

export const assignCategory = (txId: number, categoryId: number) =>
  api.put<Transaction>(`/transactions/${txId}/category`, { category_id: categoryId }).then(r => r.data)

export const fetchAssets = () =>
  api.get<InvestmentAsset[]>('/investments/assets').then(r => r.data)

export const createAsset = (data: { ticker: string; asset_type: string }) =>
  api.post<InvestmentAsset>('/investments/assets', data).then(r => r.data)

export const fetchPositions = () =>
  api.get<InvestmentPosition[]>('/investments/positions').then(r => r.data)

export const createInvestmentTransaction = (data: {
  asset_id: number
  account_id: number
  transaction_date: string
  quantity: number
  price_per_unit: number
  fees: number
  transaction_type: string
}) => api.post('/investments/transactions', data).then(r => r.data)

export const importFile = (accountId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<ImportResult>(`/imports/${accountId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
