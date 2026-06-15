# Kalkulagailua

App web de finanzas personales auto-hospedada. Importas tus extractos bancarios y la app categoriza, analiza y visualiza tus gastos e inversiones — sin dar acceso a tus bancos.

## Funcionalidades

- **Importación** de extractos CSV/XLSX de CaixaBank, MyInvestor, Trade Republic y Bit2me, con deduplicación automática
- **Categorización automática** por palabras clave + auto-aprendizaje al categorizar manualmente
- **Dashboard** con ahorro total, métricas por cuenta y tendencia de 6 meses
- **Analítica** con gráficos de barras y tarta por período (nómina-a-nómina, mes, trimestre, año o fechas libres), navegable hasta las transacciones
- **Seguimiento de inversiones** (acciones, ETFs, fondos, crypto) con precio actual y P&L

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 · FastAPI · SQLAlchemy 2.0 async |
| Frontend | React · TypeScript · Vite · Tailwind CSS · Recharts |
| Base de datos | PostgreSQL 16 |
| Despliegue | Docker Compose |

## Instalación

### Requisitos
- Docker y Docker Compose

### Arrancar

```bash
git clone https://github.com/inigoazkue/kalkulagailua.git
cd kalkulagailua
docker compose up -d
```

La app estará disponible en `http://localhost:3001`.

Las credenciales por defecto son `admin` / `changeme`. Cámbialas via variables de entorno:

```bash
APP_USERNAME=tuusuario APP_PASSWORD=tucontraseña docker compose up -d
```

## Bancos soportados

| Banco | Formato | Cómo exportar |
|-------|---------|---------------|
| CaixaBank | CSV | Banca online → Cuentas → Movimientos → Exportar |
| MyInvestor | CSV | Mis Movimientos → Descargar excel/CSV |
| Trade Republic | CSV | Profile → Account Statements → Transaction Export |
| Bit2me | XLSX | Histórico de actividad → Exportar por año |

## Privacidad

Todos los datos se almacenan localmente en tu servidor. Ningún dato sale al exterior salvo las consultas de precios de activos (Yahoo Finance para acciones/ETFs/fondos, CoinGecko para crypto).
