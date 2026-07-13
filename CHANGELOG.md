# Changelog

### v1.3.1
- **Fix filtro de banco en Transacciones**: el parámetro `bank` se aceptaba en la firma pero nunca se añadía a los filtros SQL; ahora filtra correctamente las transacciones por `Account.bank`
- **Vista móvil: Trans. internas**: en móvil muestra cards por fila (fecha, importe, cuentas origen/destino, estado, botones validar/rechazar/pendiente y dropdown de categoría); la selección masiva con checkbox queda solo en desktop
- **Vista móvil: Inv. pendientes**: ídem — cards con descripción, cuenta, activo asignado (o dropdown para asignarlo), estado y acciones individuales; tabla con selección masiva solo en desktop

### v1.3.0
- **Fix crash página Inversiones**: los precios del sparkline llegaban como strings y Recharts no los convertía; el tooltip recibía un índice de fila en vez de la fecha porque faltaba `<XAxis dataKey="date" hide />`; ambos arreglados
- **Borrar categoría**: ahora funciona — faltaba `cascade="all, delete-orphan"` en la relación `transaction_assignments`; al borrar, todas las transacciones de esa categoría quedan sin categorizar automáticamente
- **Quitar keyword de categoría**: al editar una categoría y eliminar un keyword, las transacciones auto-categorizadas solo por ese keyword pierden su categoría; las que también matchean otros keywords restantes la conservan
- **Filtro de banco en Transacciones**: el selector de banco filtra las transacciones (pasa `bank` al backend, incluido en el `queryKey` de TanStack Query)
- **Vista móvil: Transacciones**: en móvil muestra lista de cards (descripción, fecha, cuenta, importe, categoría inline) en lugar de la tabla
- **Nuevo icono de la app**: fondo beige (#fdf8f0), calculadora en contorno azul oscuro (#1e5ab4), generado con Pillow
- **Precios de fondos sin ticker**: búsqueda automática por ISIN en la API de Yahoo Finance (`/v1/finance/search`) para obtener el código `0P...` de fondos UCITS sin ticker de bolsa
- **Traspasos entre fondos**: registro de traspasos internos entre activos (fecha de salida/entrada, importes, comisiones, notas) con tabla editable en la página de Inversiones
- **Bump de versión a 1.3.0/1.3.1**

### v1.2.1
- **Fix saldo manual (Importar)**: el campo "Saldo disponible" usaba un input numérico nativo que no admitía el punto de miles español, causando saldos guardados ~100x más pequeños de lo real; ahora parsea correctamente el formato español (punto de miles, coma decimal)
- **Fechas en formato DD/MM/AAAA** en toda la app (Dashboard, Analítica, Transacciones, Cuentas, Trans. internas, Importar); antes la tabla de Transacciones mostraba la fecha cruda en ISO
- **Importación sin corte de antigüedad**: se elimina el "smart cutoff" que descartaba silenciosamente filas anteriores a 2 meses antes del último registro; ahora la deduplicación es por hash fila a fila contra todo el histórico, sin límite de antigüedad — permite importar extractos de años anteriores sin perder movimientos

### v1.2.0
- **Modo privacidad**: icono de ojo (cerrado por defecto) que difumina todos los importes y gráficos de la app — junto a "Ahorro total" en el Dashboard y en la esquina superior derecha del resto de páginas (Analítica, Transacciones, Cuentas, Inversiones, Trans. internas, Importar)

### v1.1.1
- **Fix parser MyInvestor**: corrige mojibake en las descripciones de transacciones (acentos UTF-8 re-leídos como Latin-1 antes de exportar, ej. "ó" → "Ã³"); nuevo helper `fix_mojibake()` reutilizable en `parsers/base.py`
- **Número de versión visible en la app**: junto a "Ajustes" en el sidebar (desktop) y en el sheet "Más" (móvil)
- **Nuevo icono de la app**: calculadora verde sobre tarjeta navy (sustituye al icono "K"), usado en favicon, PWA y pantalla de inicio

### v1.1.0
- **Backup de base de datos** (Ajustes → Backup): descarga un volcado SQL completo con todos los datos
- **Auto-categorización en background**: el servidor categoriza transacciones sin categoría cada 15 minutos usando los keywords definidos; las transacciones descategorizadas manualmente quedan excluidas permanentemente
- **Descategorización manual**: nuevo botón "Sin categoría" en el selector de categorías; marca la transacción como excluida de la auto-categorización
- **Categorías agrupadas por tipo** en el selector (Gastos fijos, Gastos variables, Inversión, Ahorro); las transacciones positivas solo muestran categorías de tipo Ingresos
- **Scroll horizontal** en la tabla de Trans. internas en móvil
- **Bottom nav** con labels exactos y secciones Principal / Ajustes en el sheet "Más"

### v1.0.0
- Release inicial: importación de extractos, categorización, dashboard, analítica, transferencias internas, inversiones, PWA instalable en Android/iOS
