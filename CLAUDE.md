# KALKULAGAILUA

App web de finanzas personales auto-hospedada, construida a medida.

## Objetivo

Control de finanzas personales sin dar acceso a los bancos. El usuario importa extractos desde el home banking y la app hace el resto.

## Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0 async (asyncpg) + Alembic
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + TanStack Query v5 + TanStack Table + Recharts
- **DB**: PostgreSQL 16
- **Despliegue**: Docker Compose (3 servicios: `db`, `backend`, `frontend`)
- **Procesado de datos**: pandas + openpyxl

## Despliegue

Servidor remoto: `inigoazkue@txistufly.org`, repo en `~/DOCKER/KALKULAGAILUA`.

Flujo de deploy:
1. Commit y push a GitHub (`git@github.com:inigoazkue/kalkulagailua.git`)
2. En el servidor: `ssh inigoazkue@txistufly.org 'cd ~/DOCKER/KALKULAGAILUA && git pull && sg docker -c "docker compose build --no-cache backend frontend && docker compose up -d"'`

Puertos: backend en `8000`, frontend en `3001`.

## Fuentes de datos externas

- Precios ISINs (acciones/ETFs/fondos): Yahoo Finance via `yfinance`
- Precios crypto: CoinGecko API (gratuita, históricos incluidos)

## Bancos y formatos de importación

| Banco | Formato | Notas |
|-------|---------|-------|
| CaixaBank | Excel (.xlsx) | Columnas: Fecha, Concepto, Importe, Saldo |
| MyInvestor | Excel (.xlsx) | "Mis Movimientos" > "Descargar excel/CSV" |
| Trade Republic | CSV nativo | Profile > Account Statements > Transaction Export |
| Bit2me | Excel (.xlsx) | Exportar por año desde "Histórico de actividad" |

## Modelo de datos real (implementado)

```
Account             — cuenta bancaria (bank, subtype: daily|savings, color, include_in_savings,
                      show_on_dashboard, is_payroll_account, current_balance, balance_date)
Transaction         — movimiento importado (account_id, date, description, amount, balance, raw_hash)
Category            — categoría (name, category_type: income|fixed_expense|variable_expense|investment,
                      color, is_default)
CategoryKeyword     — keyword de auto-categorización (category_id, keyword) — usado con ilike
TransactionCategory — asignación transaction→category (is_manual flag)
InvestmentAsset     — activo de inversión (ticker, name, asset_type: stock|etf|fund|crypto)
InvestmentTransaction — operación de inversión (buy/sell, quantity, price_per_unit, fees)
PriceCache          — precios históricos cacheados (asset_id, price_date, price)
```

### Enums importantes
- `BankEnum`: `caixabank | myinvestor | trade_republic | bit2me`
- `AccountSubtypeEnum`: `daily | savings` (se eliminaron `investment` y `crypto`)
- `CategoryTypeEnum`: `income | fixed_expense | variable_expense | investment`

## Migraciones Alembic

Patrón para cambiar un enum PostgreSQL (requiere pasos manuales):
1. `DROP DEFAULT` en la columna
2. `RENAME TYPE` al nombre viejo
3. `CREATE TYPE` nuevo sin el valor eliminado
4. `ALTER COLUMN TYPE ... USING ... ::text::nuevo_tipo`
5. `SET DEFAULT` de vuelta
6. `DROP TYPE` viejo

Migraciones existentes: `0001` (inicial), `0002` (add color), `0003` (remove investment subtype),
`0004` (remove crypto subtype), `0005` (add is_payroll_account).

## Estructura de páginas (frontend)

### Navegación (Sidebar)
- **Principal**: Dashboard, Analítica, Transacciones, Inversiones
- **Ajustes**: Cuentas, Importar, Categorías
- Botón Salir (logout)

### Dashboard (`/dashboard`)
- Selector de período (nómina/mes/trimestre/año), por defecto nómina
- Tarjeta de ahorro total (cuentas con `include_in_savings=true`)
- Tarjeta por cuenta con métricas del período

### Analítica (`/analytics`)
- Selector de período (nómina/mes/trimestre/año/entre fechas) con sub-selector
- Tabs por cuenta
- 5 tarjetas de métricas clicables → navegan a Transacciones con `?metric=...`
- Gráfico de barras diario (click en barra → transacciones de ese día)
- Gráfico de tarta por categoría (click en sector → transacciones de esa categoría)
- Datos via `GET /transactions/analytics-data` (agregación server-side con SQL)

### Transacciones (`/transactions`)
- Selector de período (todo/nómina/mes/trimestre/año/entre fechas)
- Filtro de banco → filtro de cuenta (el banco solo filtra el desplegable de cuentas)
- Filtro de tipo de categoría y categoría
- Badges activos (metric, category) con botón de eliminar
- Tabla con paginación (50 por página)
- Dropdown de categoría inline por transacción (con auto-aprendizaje)
- Inicializa desde URL params: `start`, `end`, `account_id`, `category_id`, `category_type`, `metric`

### Categorías (`/categories`)
- CRUD completo: nombre, tipo, color (paleta de 12 colores), keywords (coma-separados)
- Agrupadas por tipo
- Todas las categorías son eliminables (incluso `is_default`)

### Cuentas (`/accounts`)
- CRUD completo con checkbox `is_payroll_account`
- Campos: nombre, banco, subtipo, IBAN, color, include_in_savings, show_on_dashboard

### Importar (`/import`)
- Selección de cuenta + subida de fichero

### Inversiones (`/investments`)
- Registro de activos y operaciones buy/sell
- Posiciones con precio actual y P&L

## Lógica clave del backend

### Auto-aprendizaje de categorías (`PUT /transactions/{id}/category`)
Cuando el usuario asigna manualmente una categoría:
1. Extrae palabras significativas de la descripción (≥4 chars, no dígitos, no en `_BANKING_STOPWORDS`)
2. Añade palabras nuevas como `CategoryKeyword` de esa categoría
3. Aplica la categoría a todas las transacciones **sin categoría** cuya descripción haga ilike con algún keyword

`_BANKING_STOPWORDS` incluye: compra, pago, cargo, abono, transferencia, recibo, ingreso, cajero, bizum, etc.

### Detección de nóminas (`GET /transactions/payroll-dates`)
- Busca la cuenta con `is_payroll_account=True`
- Transacciones de esa cuenta con `amount > 2000` y descripción ilike en `['%nomina%', '%nómina%', '%salario%', '%sueldo%', '%paga extra%']`

### Filtro `metric` en `GET /transactions`
Replica exactamente la lógica de analítica:
- `income` → `amount > 0`
- `fixed_expense` / `investment` → INNER JOIN categoría por tipo
- `variable_expense` → OUTER JOIN, `amount < 0`, uncategorized OR variable_expense
- `uncategorized` → OUTER JOIN, `amount < 0`, sin categoría

### Agregación analítica (`GET /transactions/analytics-data`)
Usa `func.greatest(amount, 0)` para ingresos y `func.greatest(-amount, 0)` para gastos en SQL.
Devuelve `{daily, categories, summary}`. El bucket "Sin categoría" tiene `id: null`.

## Código compartido (frontend)

`frontend/src/utils/periods.ts` — lógica de períodos compartida entre Analytics y Transactions:
- `PeriodType`, `PERIOD_OPTIONS`
- `buildPayrollCycles(dates)` — genera ciclos nómina-a-nómina
- `computePeriod(type, cycles, ...)` — calcula `{start, end}` para cada tipo de período
- `buildMonthOptions`, `buildQuarterOptions`, `buildYearOptions`

## Gotchas y decisiones importantes

- Después de cambiar un enum en PostgreSQL es necesario hacer DROP/RENAME/CREATE (ver sección migraciones)
- El límite de `GET /transactions` es `le=2000` para soportar exportaciones grandes
- Analytics usa agregación server-side para evitar el problema del límite
- `metric=variable_expense` usa OUTER JOIN para incluir tanto sin-categoría como variable_expense
- El `is_payroll_account` filtra por keywords además de importe para evitar falsos positivos
- Los keyword extraídos para auto-aprendizaje usan regex `[^\W\d_]+` (letras Unicode, sin dígitos ni guión bajo)
