# Kalkulagailua

App web de finanzas personales auto-hospedada. Importas tus extractos bancarios y la app categoriza, analiza y visualiza tus gastos e inversiones — sin dar acceso a tus bancos.

## Funcionalidades

### Importación de extractos
- Soporta CaixaBank, MyInvestor, Trade Republic y Bit2me en CSV/XLSX
- Deduplicación automática por hash: re-importar el mismo fichero es seguro
- Corte inteligente: ignora filas más antiguas de 2 meses antes del último registro, para no reprocesar histórico innecesariamente
- Actualiza el saldo de la cuenta automáticamente cuando el CSV lo incluye
- Muestra cuántas transacciones nuevas se importaron, cuántas eran duplicados y cuántas se descartaron por antigüedad

### Categorización
- **Auto-categorización en importación**: cada transacción nueva se compara contra las palabras clave de cada categoría (búsqueda ilike)
- **Auto-aprendizaje**: al asignar manualmente una categoría, la app extrae palabras significativas de la descripción, las guarda como keywords de esa categoría y las aplica a todas las transacciones sin categoría que ya existan
- **Tipos de categoría**: Ingresos · Gastos fijos · Gastos variables · Inversión · Ahorro
- CRUD completo de categorías con nombre, tipo, color y keywords editables

### Transferencias internas
- Detección automática de movimientos entre cuentas propias: mismo importe absoluto en cuentas distintas, dentro de ±4 días
- Se detectan al importar y se pueden forzar con el botón "Detectar ahora"
- Las transferencias eliminadas manualmente se añaden a una lista negra y nunca se relinkan automáticamente
- Página dedicada con validación individual o masiva (select-all), badge de estado y categorización por fila
- Las transferencias aparecen marcadas en la lista de transacciones con un badge "Interna" que enlaza a la transferencia correspondiente
- La categoría "Ahorro" se asigna automáticamente al lado saliente de transferencias de cuenta corriente → cuenta de ahorro

### Dashboard
- Selector de período: nómina a nómina, mes, trimestre o año
- **Ahorro total**: suma de saldos actuales de las cuentas marcadas como "ahorro total"
- Tarjeta por cuenta con 4 métricas: Ingresos · Gastos (fijos | variables) · Ahorro | Inversión · Neto del período
- Tarta de gastos por categoría del período (cuentas de ahorro total)
- Tendencia de ingresos y ahorro de los últimos 6 meses

### Analítica
- Selector de período flexible: nómina a nómina, mes, trimestre, año o fechas libres
- Vista por cuenta con saldo actual
- 6 tarjetas de métricas clicables que navegan a las transacciones filtradas: Ingresos, Gastos fijos, Gastos variables, Inversión, Ahorro, Neto
- Gráfico de barras de ingresos y gastos diarios (click en barra → transacciones de ese día)
- Gráfico de tarta de gastos por categoría (click en sector → transacciones de esa categoría)

### Transacciones
- Filtros combinados: período, banco, cuenta, tipo de categoría, categoría concreta
- Paginación de 50 en 50
- Asignación de categoría inline con auto-aprendizaje
- Inicialización desde URL para drill-down desde analítica o dashboard

### Inversiones
- Registro de activos: acciones, ETFs, fondos y crypto
- Registro de operaciones de compra/venta con cantidad, precio y comisiones
- Posiciones consolidadas con precio actual (Yahoo Finance / CoinGecko) y P&L

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 · FastAPI · SQLAlchemy 2.0 async · Alembic |
| Frontend | React · TypeScript · Vite · Tailwind CSS · TanStack Query v5 · Recharts |
| Base de datos | PostgreSQL 16 |
| Despliegue | Docker Compose |

## Bancos soportados

| Banco | Formato | Saldo automático | Cómo exportar |
|-------|---------|-----------------|---------------|
| CaixaBank | CSV | Sí | Banca online → Cuentas → Movimientos → Exportar |
| MyInvestor | CSV | Cuando disponible | Mis Movimientos → Descargar excel/CSV |
| Trade Republic | CSV | Cuando disponible | Profile → Account Statements → Transaction Export |
| Bit2me | XLSX | No | Histórico de actividad → Exportar por año |

## Instalación en el móvil (PWA)

La app es una PWA instalable en Android e iOS directamente desde el navegador — sin Play Store.

**Android (Chrome):**
1. Abre la app en Chrome
2. Chrome mostrará un banner "Añadir a pantalla de inicio" (o busca la opción en el menú ⋮)
3. Confirma → aparece el icono en el launcher como una app nativa

**iOS (Safari):**
1. Abre la app en Safari
2. Menú compartir (□↑) → "Añadir a pantalla de inicio"
3. Confirma

**Importar CSV desde el móvil:**
- En la pantalla Importar, toca la zona de carga de cada cuenta
- Android abrirá el selector de archivos: accede a Descargas, Google Drive, etc.
- Los extractos descargados desde el banco (o enviados por email / Drive) son directamente accesibles

> La app debe estar en HTTPS para que la instalación PWA funcione. Si usas el dominio propio, asegúrate de tener certificado SSL activo.

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

Las migraciones de base de datos se aplican automáticamente al arrancar.

## Privacidad

Todos los datos se almacenan localmente en tu servidor. Ningún dato sale al exterior salvo las consultas de precios de activos (Yahoo Finance para acciones/ETFs/fondos, CoinGecko para crypto).
