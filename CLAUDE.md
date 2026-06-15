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

| Banco | Formato | Saldo en CSV | Notas |
|-------|---------|--------------|-------|
| CaixaBank | CSV (.csv) | ✓ Siempre | Columnas: Fecha, Concepto, Importe, Saldo |
| MyInvestor | CSV (.csv) | ✓ Cuando disponible | "Mis Movimientos" > "Descargar excel/CSV" |
| Trade Republic | CSV nativo | Cuando disponible | Profile > Account Statements > Transaction Export |
| Bit2me | Excel (.xlsx) | ✗ Nunca | Exportar por año desde "Histórico de actividad" |

## Modelo de datos real (implementado)

```
Account             — cuenta bancaria (bank, subtype: daily|savings, color, include_in_savings,
                      show_on_dashboard, is_payroll_account, current_balance, balance_date,
                      last_transaction_date [computed en list_accounts])
Transaction         — movimiento importado (account_id, date, description, amount, balance, raw_hash)
Category            — categoría (name, category_type: income|fixed_expense|variable_expense|investment|savings,
                      color, is_default)
CategoryKeyword     — keyword de auto-categorización (category_id, keyword) — usado con ilike
TransactionCategory — asignación transaction→category (is_manual flag)
InternalTransfer    — par de transacciones que son transferencia interna entre cuentas propias
                      (tx_out_id FK, tx_in_id FK, matched_at, is_manual, is_validated)
TransferBlocklist   — pares que el usuario ha deslinkado manualmente; nunca se relinkan
                      (tx_out_id FK, tx_in_id FK, blocked_at, UNIQUE(tx_out_id, tx_in_id))
InvestmentAsset     — activo de inversión (ticker, name, asset_type: stock|etf|fund|crypto)
InvestmentTransaction — operación de inversión (buy/sell, quantity, price_per_unit, fees)
PriceCache          — precios históricos cacheados (asset_id, price_date, price)
```

### Enums importantes
- `BankEnum`: `caixabank | myinvestor | trade_republic | bit2me`
- `AccountSubtypeEnum`: `daily | savings`
- `CategoryTypeEnum`: `income | fixed_expense | variable_expense | investment | savings`

### Categoría por defecto "Ahorro"
- Tipo `savings`, color `#10b981`, se crea automáticamente en `startup_event` de `main.py`
- Se auto-asigna al `tx_out` (lado saliente) de transferencias detectadas de cuenta `daily` → cuenta `savings`

## Migraciones Alembic

Patrón para cambiar un enum PostgreSQL (requiere pasos manuales):
1. `DROP DEFAULT` en la columna
2. `RENAME TYPE` al nombre viejo
3. `CREATE TYPE` nuevo sin el valor eliminado
4. `ALTER COLUMN TYPE ... USING ... ::text::nuevo_tipo`
5. `SET DEFAULT` de vuelta
6. `DROP TYPE` viejo

Migraciones existentes:
- `0001` (inicial), `0002` (add color), `0003` (remove investment subtype), `0004` (remove crypto subtype), `0005` (add is_payroll_account)
- `0006` internal_transfers table
- `0007` transfer_blocklist table
- `0008` is_validated en internal_transfers
- `0009` savings en categorytypeenum (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`)

## PWA (Progressive Web App)

Archivos en `frontend/public/`:
- `manifest.json` — nombre, iconos, display: standalone, theme/background color
- `icon.svg` — icono K geométrico con fondo slate/verde, sirve para launcher y splash
- `sw.js` — service worker: network-first para assets estáticos, nunca intercepta `/api/`

Registrado en `main.tsx` (window load event). El SW habilita la instalación nativa en Android vía Chrome → "Añadir a pantalla de inicio".

Requisito de instalación: la app debe estar en HTTPS.

### Navegación móvil
- **Desktop (md+)**: sidebar fijo a la izquierda (w-56)
- **Móvil (<md)**: sidebar oculto, header top con título + `BottomNav.tsx`
- `BottomNav`: 5 tabs fijos (Inicio, Analítica, Movim., Importar, Más) + sheet overlay para el resto (Trans. internas, Inversiones, Cuentas, Categorías, Salir)
- El contenido principal tiene `pb-20 md:pb-6` para no quedar tapado por el bottom nav
- `paddingBottom: env(safe-area-inset-bottom)` en el bottom bar para iPhones con notch/home indicator

## Estructura de páginas (frontend)

### Navegación (Sidebar)
- **Principal**: Dashboard, Analítica, Transacciones, Trans. internas, Inversiones
- **Ajustes**: Cuentas, Importar, Categorías
- Botón Salir (logout)

### Dashboard (`/dashboard`)
- Selector de período (nómina/mes/trimestre/año), por defecto nómina
- **Ahorro total** (top-right): suma de `current_balance` de cuentas con `include_in_savings=true`
- Tarjeta por cuenta con métricas del período (solo cuentas con `show_on_dashboard=true`):
  - Grid 2×2: **Ingresos** | **Gastos (Fijos | Variables split)** / **Ahorro | Inversión split** | **Neto período**
  - Los cuadritos de gastos y de ahorro/inversión muestran dos valores separados por un divisor vertical
- Tarta "Gasto por categoría": usa `fetchAnalyticsData` con `savings_only=true` — server-side, incluye bucket "Sin categorizar"
- Tendencia 6 meses: `fetchSummary` con `savings_only=true` por cada mes natural — solo cuentas de ahorro

### Analítica (`/analytics`)
- Selector de período (nómina/mes/trimestre/año/entre fechas) con sub-selector
- Tabs por cuenta (con saldo actual bajo el nombre)
- 6 tarjetas de métricas clicables (Ingresos, Gastos fijos, Gastos variables, Inversión, Ahorro, Neto) → navegan a Transacciones con `?metric=...`
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
- Si la transacción es `is_internal_transfer=true`: muestra badge "Interna" con link a `/transfers?highlight={transfer_id}` + categoría actual (sin dropdown, sin auto-aprendizaje)
- Inicializa desde URL params: `start`, `end`, `account_id`, `category_id`, `category_type`, `metric`

### Trans. internas (`/transfers`)
- Lista todas las `InternalTransfer` ordenadas por fecha de la TX (más reciente primero)
- Columnas: fecha, TX (cuenta saliente + descripción + dropdown de categoría sin auto-learning), RX (cuenta entrante + descripción), importe, estado (Auto/Manual + Validada)
- Select-all checkbox + acciones bulk: "Validar selección" / "Desvalidar"
- Por fila: checkbox individual + botón validar (Check, verde si validada) + botón eliminar (Trash2)
- Eliminar: inserta en `transfer_blocklist` → el par nunca se relinká automáticamente
- Botón "Detectar ahora": `POST /transfers/detect` sobre todos los txs no linkados
- Si URL contiene `?highlight={id}`: la fila se resalta en azul y hace scroll al centro

### Importar (`/import`)
- Agrupado por banco
- Por cada cuenta: fecha de última importación, saldo editable (lápiz → form inline)
- Zona de drop/click para CSV/XLSX
- Tras importar: muestra `imported`, `duplicates`, `skipped_old`, aviso si hay que actualizar saldo manualmente

### Categorías (`/categories`)
- CRUD completo: nombre, tipo, color (paleta de 12 colores), keywords (coma-separados)
- Agrupadas por tipo
- Todas las categorías son eliminables (incluso `is_default`)

### Cuentas (`/accounts`)
- CRUD completo con checkbox `is_payroll_account`
- Muestra `last_transaction_date` en cada tarjeta (computed en el endpoint)

### Inversiones (`/investments`)
- Registro de activos y operaciones buy/sell
- Posiciones con precio actual y P&L

## Lógica clave del backend

### Endpoints de cuentas
- `GET /accounts` — lista todas, incluye `last_transaction_date` (MAX(date) por cuenta via subquery)
- `POST /accounts` — crear
- `PUT /accounts/{id}` — editar
- `PUT /accounts/{id}/balance` — actualizar solo saldo y fecha
- `DELETE /accounts/{id}` — eliminar

### Importación (`POST /imports/{account_id}`)
Devuelve `{ imported, duplicates, skipped_old, last_transaction_date, balance_updated }`.
Flujo:
1. Parsear CSV/XLSX
2. Smart cutoff: si hay historial, descartar filas anteriores a `last_recorded - 2 meses`
3. Deduplicación por hash
4. Para cada TX nueva: insertar + `auto_categorize(description)` via keywords
5. `match_transfers(db, new_tx_ids)` — detectar pares intra
6. `auto_categorize_savings_transfers(db)` — asignar Ahorro a tx_out de daily→savings
7. Commit

### Deduplicación de transacciones (lógica hash)
El hash `raw_hash` se calcula en `parsers/base.py`:
- **Ocurrencia 1**: `SHA256(fecha|descripción|importe)` — retrocompatible
- **Ocurrencia 2+**: `SHA256(fecha|descripción|importe|{saldo})` o `SHA256(...|occ:N)`
- El contador se reinicia en cada importación (por sesión)

### Auto-aprendizaje de categorías (`PUT /transactions/{id}/category`)
Parámetro `learn: bool = Query(True)`. Cuando `learn=True`:
1. Extrae palabras de la descripción (≥4 chars, no dígitos, no en `_BANKING_STOPWORDS`)
2. Añade palabras nuevas como `CategoryKeyword`
3. Aplica categoría a todas las transacciones sin categoría que hagan ilike con algún keyword

La pantalla de Trans. internas llama siempre con `?learn=false` para evitar contaminación de keywords.

`_BANKING_STOPWORDS` incluye: compra, pago, cargo, abono, transferencia, recibo, ingreso, cajero, bizum, ahorro, etc.

### Detección de transferencias internas
`match_transfers(db, new_tx_ids)` (en import) y `match_all_transfers(db)` (en detect):
- Para cada TX negativa (salida): busca TX positiva de mismo `abs(amount)` en otra cuenta, con fecha ±4 días
- Excluye pares en `transfer_blocklist`
- Si exactamente 1 candidato: crea `InternalTransfer(is_manual=False)`

Al eliminar una transferencia: inserta en `TransferBlocklist` primero → nunca se relinká con "Detectar ahora".

### Categorización automática de transferencias de ahorro
`auto_categorize_savings_transfers(db)`:
- Busca categoría con `category_type=savings` (la "Ahorro" por defecto)
- Para cada `InternalTransfer` donde `tx_out.account.subtype=daily` y `tx_in.account.subtype=savings` y `tx_out` no tiene categoría: asigna Ahorro (is_manual=False)
- Corre después de match en import y después de detect

### Detección de nóminas (`GET /transactions/payroll-dates`)
- Busca la cuenta con `is_payroll_account=True`
- Transacciones de esa cuenta con `amount > 2000` y descripción ilike en keywords de nómina

### Filtro `metric` en `GET /transactions`
Replica exactamente la lógica de analítica:
- `income` → `amount > 0`
- `fixed_expense` / `investment` / `savings` → INNER JOIN categoría por tipo
- `variable_expense` → OUTER JOIN, `amount < 0`, uncategorized OR variable_expense
- `uncategorized` → OUTER JOIN, `amount < 0`, sin categoría

### Modelo de analítica (doble entrada para transferencias internas)
Todas las transacciones se incluyen en analítica (sin filtrar transferencias internas).
- TX saliente (categorizada como Ahorro): se suma en `savings_transfer`
- RX entrante (sin categoría): suma en `income`
- El `net = income - fixed - variable - investment - savings_transfer` se cancela correctamente

### Parámetro `savings_only`
`GET /transactions/summary?savings_only=true` y `analytics-data?savings_only=true`
Filtra: `Transaction.account_id IN (SELECT id FROM accounts WHERE include_in_savings = true)`

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

- Después de cambiar un enum en PostgreSQL es necesario hacer DROP/RENAME/CREATE (excepción: ADD VALUE puede hacerse con `ALTER TYPE ... ADD VALUE IF NOT EXISTS`)
- El límite de `GET /transactions` es `le=2000` para soportar exportaciones grandes
- Analytics y Dashboard usan agregación server-side para evitar el problema del límite
- `metric=variable_expense` usa OUTER JOIN para incluir tanto sin-categoría como variable_expense
- El `is_payroll_account` filtra por keywords además de importe para evitar falsos positivos
- Los keyword extraídos para auto-aprendizaje usan regex `[^\W\d_]+` (letras Unicode, sin dígitos ni guión bajo)
- El hash de deduplicación usa ocurrencia-1 = fórmula antigua (retrocompatible con DB existente)
- `is_internal_transfer` y `transfer_id` se monkey-patchean en los objetos SQLAlchemy antes de serializar con Pydantic
- La pantalla Trans. internas usa `?learn=false` en assign_category para no contaminar keywords con descripciones de transferencias
