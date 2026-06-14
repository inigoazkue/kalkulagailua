# KALKULAGAILUA

App web de finanzas personales auto-hospedada, construida a medida.

## Objetivo

Control de finanzas personales sin dar acceso a los bancos. El usuario importa extractos desde el home banking y la app hace el resto.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **DB**: PostgreSQL
- **Despliegue**: Docker Compose
- **Gráficas**: Recharts
- **Procesado de datos**: pandas + openpyxl

## Fuentes de datos externas

- Precios ISINs (acciones/ETFs/fondos): Yahoo Finance via `yfinance`
- Precios crypto: CoinGecko API (gratuita, históricos incluidos)

## Bancos y formatos de importación

| Banco | Formato | Notas |
|-------|---------|-------|
| CaixaBank | Excel (.xlsx) | Columnas: Fecha, Concepto, Importe, Saldo |
| MyInvestor | Excel (.xlsx) | "Mis Movimientos" > "Descargar excel/CSV" |
| Trade Republic | CSV nativo | Profile > Account Statements > Transaction Export. Cubre cuenta + inversiones + crypto |
| Bit2me | Excel (.xlsx) | Exportar por año desde "Histórico de actividad" |

## Funcionalidades

### Importación
- Parser por banco (cada uno con su mapeo de columnas)
- Soporte Excel (.xlsx) y CSV
- Deduplicación de transacciones en reimportaciones

### Gastos y ahorro
- Categorización automática por reglas (keywords en el concepto)
- Categorías editables manualmente
- Flag **gasto fijo** vs **gasto variable** por categoría
- Vista de ahorro real (ingresos − gastos totales)

### Inversiones
- Registro de posiciones por ISIN (acciones, ETFs, fondos)
- Registro de posiciones crypto (BTC, ETH, etc.) — tanto Bit2me como Trade Republic
- Consulta de precio histórico para calcular rentabilidad
- Vista anual: capital invertido vs valor actual vs rentabilidad

## Modelo de datos (esquema inicial)

```
Account         — cuenta bancaria/broker/crypto wallet
Transaction     — movimiento importado (fecha, importe, concepto, cuenta)
Category        — categoría (nombre, tipo: fijo/variable/inversión/ingreso)
TransactionCategory — asignación transaction→category (editable)
InvestmentPosition  — posición de inversión (ISIN o ticker crypto, cantidad, precio medio)
PriceCache      — precios históricos cacheados
```

## Decisiones pendientes

- [ ] ISINs concretos de las inversiones del usuario (para pre-configurar)
- [ ] ¿Bit2me se trata como "inversión" (seguimiento de valor) o solo como transacciones?
- [ ] Idioma de la UI (¿euskera, castellano, inglés?)

## Despliegue

Docker Compose con tres servicios: `backend`, `frontend`, `db` (postgres).
