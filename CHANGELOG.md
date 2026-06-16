# Changelog

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
