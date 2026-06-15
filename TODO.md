# TODO

Funcionalidades pendientes de implementar.

---

## Smart import: evitar reimportar duplicados automáticamente

### Qué debe hacer
Al importar un CSV, en lugar de procesar todas las filas, la app debe:
1. Leer la **última fecha registrada** para esa cuenta en la DB (`MAX(date)` en `transactions` filtrado por `account_id`)
2. Retroceder **2 meses** desde esa fecha como margen de seguridad
3. Ignorar silenciosamente las filas del CSV cuya fecha sea anterior al margen (ya están en la DB)
4. Procesar solo las filas desde el margen en adelante (el sistema de hash ya gestiona los duplicados exactos dentro de ese rango)

### Por qué el margen de 2 meses
Algunos bancos pueden reordenar o rectificar transacciones con fecha retroactiva. El margen asegura que no se pierda nada reciente.

### Además: mostrar última fecha registrada en Cuentas y en Importar
- En la página de **Cuentas** (`/accounts`): mostrar junto al nombre de cada cuenta la fecha de la última transacción importada
- En la página de **Importar** (`/import`): mostrar bajo el nombre de cada cuenta "Última importación: DD MMM YYYY" (o "Sin datos" si no hay transacciones)
- El dato se obtiene con una query: `SELECT MAX(date) FROM transactions WHERE account_id = ?`
- Podría añadirse al `AccountOut` schema como `last_transaction_date: Optional[date]` calculada en el endpoint `GET /accounts`, o como endpoint separado

### Cambios necesarios
**Backend:**
- `GET /accounts`: añadir campo `last_transaction_date` (subquery o join con transactions)
- `POST /imports/{account_id}`: antes de procesar, calcular el cutoff (`last_date - 2 months`), filtrar `parsed` para descartar filas anteriores al cutoff
- Devolver en `ImportResult` cuántas filas se descartaron por ser anteriores al cutoff (no confundir con duplicados exactos)

**Frontend:**
- `AccountOut` interface en `client.ts`: añadir `last_transaction_date: string | null`
- `Accounts.tsx`: mostrar `last_transaction_date` en cada tarjeta de cuenta
- `Import.tsx`: mostrar `last_transaction_date` bajo el nombre en cada `AccountUploadBox`

---

## TX ↔ RX: transferencias internas entre cuentas propias

### Qué debe hacer
Las transferencias entre una cuenta corriente y una cuenta de ahorro (o entre cualquier par de cuentas propias) no son un gasto ni un ingreso real — el dinero sigue dentro del ecosistema financiero del usuario. Deben:
1. **Detectarse automáticamente** al importar: si una transacción negativa en cuenta A tiene contrapartida positiva equivalente en cuenta B (mismo importe absoluto, misma fecha ± 2 días, ambas cuentas del usuario)
2. **Marcarse como transferencia interna** con un par de referencias cruzadas (TX en cuenta A apunta a RX en cuenta B y viceversa)
3. **Excluirse de todos los cálculos** de ingresos, gastos y ahorro (analytics-data, summary, dashboard)

### Modelo de datos propuesto
Nueva tabla `internal_transfer`:
```
id              — PK
tx_out_id       — FK → transactions.id (la salida, amount < 0)
tx_in_id        — FK → transactions.id (la entrada, amount > 0)
matched_at      — timestamp
is_manual       — bool (true si el usuario la confirmó/creó manualmente)
```

### Lógica de detección
Al importar transacciones nuevas, para cada transacción `t_out` (amount < 0):
- Buscar en transactions de **otras cuentas del mismo usuario** una `t_in` con:
  - `amount = ABS(t_out.amount)` (mismo importe exacto)
  - `date` entre `t_out.date - 2 días` y `t_out.date + 2 días`
  - Sin `internal_transfer` ya asignado
- Si hay match único → crear `internal_transfer` automáticamente con `is_manual=False`
- Si hay ambigüedad (varios posibles matches) → dejar sin marcar, el usuario lo resuelve manualmente

### UI propuesta
- En **Transacciones**: las transferencias internas muestran un badge especial "↔ Interna" en lugar del dropdown de categoría
- En **Ajustes → Cuentas** o en una nueva sección: lista de transferencias detectadas/pendientes de confirmar
- Botón manual "Marcar como transferencia interna" al seleccionar dos transacciones

### Impacto en cálculos
Añadir filtro en todos los endpoints de agregación:
```sql
LEFT JOIN internal_transfer it ON (transactions.id = it.tx_out_id OR transactions.id = it.tx_in_id)
WHERE it.id IS NULL
```
Afecta a: `GET /transactions/summary`, `GET /transactions/analytics-data`, y cualquier cálculo futuro.

### Cambios necesarios
**Backend:**
- Nueva migración Alembic: tabla `internal_transfer`
- Nuevo modelo SQLAlchemy `InternalTransfer`
- Lógica de detección en `routers/imports.py` o nuevo servicio `services/transfer_matcher.py`
- Filtro en `transactions.py` (summary y analytics-data)
- Nuevos endpoints: `GET /transfers` (lista), `POST /transfers` (match manual), `DELETE /transfers/{id}` (desmarcar)

**Frontend:**
- Badge visual en tabla de Transacciones
- Sección en Ajustes o modal de revisión de transferencias pendientes
