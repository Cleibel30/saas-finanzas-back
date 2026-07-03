# TASKS — Lista de Tareas Atómicas por Requerimiento

Leyenda: `[x]` Hecho · `[ ]` Pendiente · `[~]` Parcial

---

## FASE 1: Core Funcional (100% Implementado)

### 1.1 Infraestructura Base
- [x] Configurar NestJS v11 con TypeScript
- [x] Configurar Prisma v7.8 con PostgreSQL (Supabase)
- [x] Configurar PrismaClient con `@prisma/adapter-pg`
- [x] Configurar `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- [x] Configurar Helmet (seguridad HTTP headers)
- [x] Configurar CORS multi-origen desde `FRONTEND_URL`
- [x] Configurar `@nestjs/throttler` global (120 req/60s)
- [x] Configurar `ConfigModule` global

### 1.2 Autenticación (Auth Module)
- [x] Implementar `JwtStrategy` con ES256 y JWK (coordenadas X/Y de Supabase)
- [x] Validar issuer y audience del JWT en estrategia
- [x] Crear `POST /auth/register` con rate limit 5/60s
- [x] Crear `POST /auth/login` con rate limit 10/60s
- [x] Crear `GET /auth/profile` (JWT protegido)
- [x] Crear DTOs: `RegisterDto`, `LoginDto`, `UserDto`
- [x] Validar password match en registro
- [x] Verificar email único antes de crear usuario
- [x] Integrar con Supabase Auth (`supabase.auth.signUp`, `signInWithPassword`)
- [x] Crear usuario en DB local después de Supabase Auth

### 1.3 Modelo de Datos (Prisma Schema)
- [x] Crear enum `UserRole` (`USER`, `ADMIN`)
- [x] Crear modelo `User` con todos los campos especificados
- [x] Crear modelo `Plan` con `maxCompanies`, `price`, `isPremium`
- [x] Crear modelo `Subscription` con FK a User y Plan
- [x] Crear modelo `Company` con FK a User
- [x] Crear modelo `Category` con FK opcional a Company
- [x] Crear enum `CategoryType` (`OPERATING`, `INVESTING`, `FINANCING`)
- [x] Crear enum `FlowDirection` (`INFLOW`, `OUTFLOW`)
- [x] Crear modelo `Item` con FK a Company
- [x] Crear enum `ItemType` (`PRODUCT`, `SERVICE`)
- [x] Crear modelo `ProductionBatch` con FK a Company e Item
- [x] Crear enum `BatchStatus` (`OPEN`, `CLOSED`)
- [x] Crear modelo `Transaction` con FKs a Company, Category, Item? y Batch?
- [x] Crear enum `TransactionStatus` (`PENDING`, `COMPLETED`)
- [x] Crear enum `PaymentMethod` (8 valores)
- [x] Crear enum `Currency` (`BOLIVARES`, `DOLARES`)

### 1.4 Módulo Company
- [x] Crear `POST /company/create`
- [x] Crear `PATCH /company/update/:id` con ValidateCompanyGuard
- [x] Crear `GET /company/my-companies`
- [x] Crear `GET /company/:id` con ValidateCompanyGuard
- [x] Implementar `verifyCompanyOwnership(companyId, userId)`
- [x] Crear `CreateCompanyDto` con validación de nombre

### 1.5 Módulo Category
- [x] Crear `POST /category/create/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /category/list/:companyId` (incluye defaults globales) con ValidateCompanyGuard
- [x] Crear `POST /category/delete/:companyId/:categoryId` (soft delete) con ValidateCompanyGuard
- [x] Crear `POST /category/update/:companyId/:categoryId` con ValidateCompanyGuard
- [x] Crear `GET /category/get-by-name/:name/:companyId` (fuzzy search) con ValidateCompanyGuard
- [x] Implementar fuzzy search SQL con `pg_trgm` + fallback Prisma `contains`
- [x] Implementar migración de funciones SQL `search_category_fuzzy`

### 1.6 Módulo Item
- [x] Crear `POST /item/create/:companyId` (batch create) con ValidateCompanyGuard
- [x] Crear `PATCH /item/update/:itemId/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /item/get-all/:companyId` con ValidateCompanyGuard
- [x] Crear `DELETE /item/delete/:itemId/:companyId` (soft delete) con ValidateCompanyGuard
- [x] Crear `GET /item/get-by-name/:name/:companyId` (fuzzy search) con ValidateCompanyGuard
- [x] Crear `GET /item/get-all-products/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /item/get-all-services/:companyId` con ValidateCompanyGuard
- [x] Implementar fuzzy search SQL con `pg_trgm` + fallback Prisma `contains`
- [x] Implementar migración de funciones SQL `search_item_fuzzy`

### 1.7 Módulo Transaction
- [x] Crear `POST /transaction/create/:companyId` (bulk) con ValidateCompanyGuard
- [x] Crear `GET /transaction/get-all/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /transaction/get-by-id/:companyId/:transactionId` con ValidateCompanyGuard
- [x] Crear `PATCH /transaction/update/:companyId/:transactionId` con ValidateCompanyGuard
- [x] Crear `DELETE /transaction/delete/:companyId/:transactionId` (soft delete) con ValidateCompanyGuard
- [x] Crear `GET /transaction/get-by-date-range/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /transaction/get-by-date-category/:companyId/:categoryId` con ValidateCompanyGuard
- [x] Implementar lógica multi-moneda (`calculateAmounts`)
- [x] Implementar control de stock (decrementar `stockCurrent` para PRODUCT + INFLOW)
- [x] Validar FKs (category, item, batch) contra la compañía
- [x] Usar `prisma.$transaction` para operaciones atómicas

### 1.8 Módulo Production Batch
- [x] Crear `POST /production-batch/create/:companyId/:itemId` con ValidateCompanyGuard
- [x] Crear `GET /production-batch/get-all/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /production-batch/get-all-by-product/:companyId/:itemId` con ValidateCompanyGuard
- [x] Crear `GET /production-batch/get-all-by-batch-id/:companyId/:batchId` con ValidateCompanyGuard
- [x] Crear `PATCH /production-batch/update/:companyId/:batchId` con ValidateCompanyGuard
- [x] Crear `PATCH /production-batch/delete/:companyId/:batchId` (soft delete) con ValidateCompanyGuard
- [x] Validar que item sea tipo PRODUCT (no SERVICE)
- [x] Crear batch + transacciones atómicamente en `$transaction`

### 1.9 Módulo Cash Flow
- [x] Crear `GET /cash-flow/total-cashflow/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /cash-flow/cashflow/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Agrupar por moneda (USD/BS)
- [x] Calcular `current_balance`, `pending_inflow`, `pending_outflow`, `net_cash_flow`
- [x] Desglosar por `CategoryType` (OPERATING / INVESTING / FINANCING)

### 1.10 Módulo Contribution Margin
- [x] Crear `GET /contribution-margin/global/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /contribution-margin/product-global/:itemId/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /contribution-margin/product/:batchId/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /contribution-margin/service/:itemId/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Calcular margen global = Ventas - Costos Variables
- [x] Calcular margen por producto (con costo promedio de lotes)
- [x] Calcular margen por lote
- [x] Calcular margen por servicio

### 1.11 Módulo Balance Point
- [x] Crear `GET /balance-point/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Break-Even = Costos Fijos / Ratio MC Global
- [x] Devolver `isSafe` booleano y `distanceToBreakEven`

### 1.12 Módulo MCP (Model Context Protocol)
- [x] Crear servidor HTTP SSE con `@modelcontextprotocol/sdk`
- [x] Deshabilitar por defecto (`MCP_HTTP_ENABLED=false`)
- [x] Implementar `AsyncLocalStorage` para aislamiento por tenant
- [x] Registrar endpoint `GET /mcp/sse/:companyId` con ValidateCompanyGuard
- [x] Registrar endpoint `POST /mcp/messages`
- [x] Registrar herramienta `get_global_margin`
- [x] Registrar herramienta `get_product_margin`
- [x] Registrar herramienta `get_service_margin`
- [x] Registrar herramienta `get_product_margin_by_batch`
- [x] Registrar herramienta `get_break_even_point`
- [x] Registrar herramienta `search_item_by_name`
- [x] Registrar herramienta `search_category_by_name`
- [x] Registrar herramienta `list_categories`
- [x] Registrar herramienta `list_items`
- [x] Registrar herramienta `list_products`
- [x] Registrar herramienta `list_services`
- [x] Registrar herramienta `list_transactions`
- [x] Registrar herramienta `get_transaction_by_id`
- [x] Registrar herramienta `get_transactions_by_date_range`
- [x] Registrar herramienta `get_transactions_by_category`
- [x] Registrar herramienta `list_production_batches`
- [x] Registrar herramienta `get_batches_by_product`
- [x] Registrar herramienta `get_batch_by_id`
- [x] Registrar herramienta `get_total_cash_flow`
- [x] Registrar herramienta `get_cash_flow_by_date_range`

### 1.13 Módulo Groq Agent
- [x] Implementar GroqAgentService con SDK de Groq
- [x] Implementar `detectarConsultaEncadenada()` (chain detection)
- [x] Implementar `planificarEjecucionDirecta()` (regex direct planning)
- [x] Implementar `inferirHerramientaPorPalabrasClave()` (keyword inference)
- [x] Implementar fallback LLM con Groq (`llama-3.3-70b-versatile`)
- [x] Implementar `extraerRangoFechas()` (date range parsing)
- [x] Implementar `extraerNombreEntidad()` (entity name extraction)
- [x] Implementar `elegirMejorCoincidencia()` (fuzzy entity matching)

### 1.14 Módulo Finance Chat
- [x] Crear `POST /finance-chat/ask/:companyId` con ValidateCompanyGuard y rate limit 30/60s
- [x] Crear DTO `ChatBodyDto` con validación de longitud

### 1.15 Guards y Seguridad
- [x] Implementar `PublicDecorator` (`@Public()`)
- [x] Implementar `JwtAuthGuard` global con verificación de `isSuspended`
- [x] Implementar `ValidateCompanyGuard` con verificación de ownership + `isSuspended`
- [x] Configurar `ThrottlerGuard` global
- [x] Soft deletes en todas las entidades (campo `isRemoved`)

### 1.16 Migraciones de Base de Datos
- [x] Migración inicial `20260506223448_init`
- [x] Migración `20260524120000_add_fuzzy_search_functions` (pg_trgm)
- [x] Migración `20260529120000_optional_password_hash`
- [x] Migración `20260603202045_add_payment_fields`
- [x] Migración `20260603205942_rename_amount_to_amount_usd`
- [x] Migración `20260603223604_add_user_role` (UserRole enum)
- [x] Migración `20260603225056_add_suspension_fields` (isSuspended/suspendedAt)

---

## FASE 2: Administración (0% Implementado)

### 2.1 Admin Auth
- [ ] Crear endpoint `POST /admin/auth/register` (público)
- [ ] Validar `admin_secret_key` contra env var `ADMIN_SECRET_KEY`
- [ ] Crear endpoint `POST /admin/auth/login` (público, verifica role === ADMIN)
- [ ] Devolver 403 si el usuario no es admin
- [ ] Devolver `isAdmin: true` en login response de admin
- [ ] Crear endpoint `GET /admin/auth/profile` (JWT + Admin)
- [ ] Incluir `role` en payload del JWT (para guards sin consultar DB)

### 2.2 AdminGuard
- [ ] Implementar `AdminGuard` que verifica `user.role === 'ADMIN'`
- [ ] Aplicar `AdminGuard` a todas las rutas `/admin/*`

### 2.3 Admin — Gestión de Usuarios
- [ ] Crear `GET /admin/users` (listar, paginado, búsqueda, filtro `?suspended=`)
- [ ] Crear `GET /admin/users/:userId` (detalle + compañías + plan + estado suspensión)
- [ ] Crear `PATCH /admin/users/:userId/suspend` (set `isSuspended = true`, `suspendedAt = now()`)
- [ ] Crear `PATCH /admin/users/:userId/restore` (set `isSuspended = false`, `suspendedAt = null`)
- [ ] Crear `PATCH /admin/users/:userId/role` (promover/demover admin)

### 2.4 Admin — Gestión de Compañías
- [ ] Crear `GET /admin/companies` (listar, con dueño + plan, filtro `?suspended=`)
- [ ] Crear `GET /admin/companies/:companyId` (detalle financiero solo lectura)
- [ ] Crear `PATCH /admin/companies/:companyId/suspend` (set `isSuspended = true`)
- [ ] Crear `PATCH /admin/companies/:companyId/restore` (set `isSuspended = false`)

### 2.5 Admin — Gestión de Pagos
- [ ] Crear `GET /admin/payments` (todos los pagos, filtros: status, provider, rango)
- [ ] Crear `GET /admin/payments/pending-bs` (solo pagos BS pendientes)
- [ ] Crear `PATCH /admin/payments/:paymentId/approve` (aprobar, crear/actualizar Subscription)
- [ ] Crear `PATCH /admin/payments/:paymentId/reject` (rechazar con motivo)

### 2.6 Admin — Gestión de Planes
- [ ] Crear `POST /admin/plans` (crear plan)
- [ ] Crear `GET /admin/plans` (listar planes)
- [ ] Crear `PATCH /admin/plans/:planId` (actualizar precio, límites)
- [ ] Crear `DELETE /admin/plans/:planId` (soft delete, validar sin subs activas)

### 2.7 Admin — Categorías Globales por Defecto
- [ ] Crear `POST /admin/categories/default` (crear categoría global)
- [ ] Crear `GET /admin/categories/default` (listar)
- [ ] Crear `PATCH /admin/categories/default/:categoryId` (editar)
- [ ] Crear `DELETE /admin/categories/default/:categoryId` (soft delete)

### 2.8 Admin — Dashboard y Estadísticas
- [ ] Crear `GET /admin/stats` (KPIs: usuarios, compañías, transacciones, ingresos)
- [ ] Crear `GET /admin/stats/revenue` (ingresos por mes, agrupados por plan)
- [ ] Crear `GET /admin/stats/users-growth` (nuevos usuarios por mes)
- [ ] Crear `GET /admin/stats/active-companies` (activas vs suspendidas)

### 2.9 Seed de Admin Inicial
- [ ] Crear script de seed que lee `ADMIN_EMAIL` y `ADMIN_PASSWORD` de env
- [ ] Crear usuario en Supabase Auth via Admin API
- [ ] Crear registro en tabla `users` con `role: ADMIN`

---

## FASE 3: Notificaciones y Auto-Completado (0% Implementado)

### 3.1 Modelo Notification
- [ ] Agregar modelo `Notification` al schema de Prisma
- [ ] Crear enum `NotificationType` (`PAYMENT_DUE`, `PAYMENT_COMPLETED`, `STOCK_LOW`, `BATCH_CLOSED`, `SYSTEM`)
- [ ] Crear migración para tabla `notifications`
- [ ] Regenerar Prisma Client

### 3.2 Módulo Notifications
- [ ] Crear `GET /notifications/list/:companyId` con ValidateCompanyGuard
- [ ] Crear `PATCH /notifications/read/:companyId/:notificationId` con ValidateCompanyGuard
- [ ] Crear `GET /notifications/unread-count/:companyId` con ValidateCompanyGuard

### 3.3 Cron Job de Auto-Completado
- [ ] Instalar `@nestjs/schedule` y `ScheduleModule`
- [ ] Implementar cron job cada 5 minutos
- [ ] Buscar transacciones PENDING con `paymentDate <= NOW()` y category type OPERATING
- [ ] Actualizar status a COMPLETED
- [ ] Crear Notification asociada a la compañía
- [ ] Configurar variable de entorno para intervalo del cron

---

## FASE 4: Nuevos Análisis Financieros (0% Implementado)

### 4.1 Utilidad Bruta (Gross Profit)
- [x] Crear módulo `gross-profit` con controller y service
- [x] Crear `GET /gross-profit/global/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /gross-profit/product/:itemId/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /gross-profit/service/:itemId/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Fórmula: Ventas Netas (INFLOW + COMPLETED) - COGS (OUTFLOW + isCogs + COMPLETED)
- [x] Registrar herramienta MCP `get_gross_profit`

### 4.2 Utilidad Neta (Net Profit / P&L)
- [x] Crear módulo `net-profit` con controller y service
- [x] Crear `GET /net-profit/:companyId/:startDate/:endDate` con ValidateCompanyGuard
- [x] Crear `GET /net-profit/statement/:companyId/:startDate/:endDate` (P&L estructurado) con ValidateCompanyGuard
- [x] Fórmula: Utilidad Bruta - Gastos Operativos - Gastos Inversión - Gastos Financieros
- [x] Desglose por CategoryType
- [x] Registrar herramienta MCP `get_net_profit`

### 4.3 Costo Total Unitario
- [x] Crear módulo `unit-cost` con controller y service
- [x] Crear `GET /unit-cost/batch/:batchId/:companyId` con ValidateCompanyGuard
- [x] Crear `GET /unit-cost/product/:itemId/:companyId` (promedio ponderado) con ValidateCompanyGuard
- [x] Crear `GET /unit-cost/service/:itemId/:companyId` (costo promedio por servicio) con ValidateCompanyGuard
- [x] Registrar herramienta MCP `get_unit_cost`

### 4.4 Precio con Margen Real
- [x] Crear módulo `price-margin` con controller y service
- [x] Crear `POST /price/margin-target/:companyId` con ValidateCompanyGuard
- [x] Body: `{ itemId, targetMarginPercent }` → precio recomendado
- [x] Usar `UnitCostService` para obtener costo unitario (productos y servicios)
- [x] Registrar herramienta MCP `calculate_price_with_margin`

---

## FASE 5: Escaneo de Facturas OCR (0% Implementado)

### 5.1 Módulo Invoice Scan
- [ ] Crear módulo `invoice-scan` con controller y service
- [ ] Crear `POST /invoice-scan/parse/:companyId` con ValidateCompanyGuard
- [ ] Aceptar `multipart/form-data` (jpg, png, webp, pdf)
- [ ] Integrar OCR (Gemini Vision API, GPT-4o, o Tesseract + Groq)
- [ ] Estructurar texto extraído en objetos `CreateTransactionDto`
- [ ] Resolver `categoryName` e `itemName` contra DB de la compañía (fuzzy search)
- [ ] NO guardar en base de datos — solo devolver datos parseados
- [ ] Configurar `GEMINI_API_KEY` + `CLOUDINARY_*` para subida temporal de imágenes

---

## FASE 6: Sistema de Pagos (0% Implementado)

### 6.1 Modelo Payment
- [ ] Agregar modelo `Payment` al schema de Prisma
- [ ] Crear enum `PaymentProvider` (`STRIPE`, `PAYPAL`, `BANK_TRANSFER`)
- [ ] Crear enum `PaymentStatus` (`PENDING`, `COMPLETED`, `REJECTED`, `EXPIRED`)
- [ ] Crear migración para tabla `payments`
- [ ] Regenerar Prisma Client

### 6.2 Módulo Payments — Stripe / PayPal (USD)
- [ ] Instalar `stripe` SDK
- [ ] Crear `POST /payment/create-intent` (JWT)
- [ ] Integrar Stripe Checkout / Payment Intent
- [ ] Integrar PayPal Orders API
- [ ] Crear `POST /payment/webhook/stripe` (público, validar firma)
- [ ] Crear `POST /payment/webhook/paypal` (público, validar firma)
- [ ] Al recibir confirmación: crear/actualizar Subscription + Notification

### 6.3 Módulo Payments — Comprobante BS
- [ ] Crear `POST /payment/upload-receipt` (JWT, multipart)
- [ ] Integrar upload a S3/Cloudinary
- [ ] Crear Payment con `status: PENDING`, `receiptImageUrl`
- [ ] Notificar al admin via Notification
- [ ] Vincular con endpoints admin de aprobación/rechazo

---

## FASE 7: Reportes PDF / Excel / Gráficos (0% Implementado)

### 7.1 ReportService
- [ ] Crear módulo `reports` con `ReportService`
- [ ] Instalar `pdfkit` o `@jsreport/nodejs-client` para PDF
- [ ] Instalar `exceljs` para Excel
- [ ] Instalar `chart.js` (server-side con `canvas`) o `vega-lite` para gráficos

### 7.2 Endpoints REST
- [ ] Crear `GET /reports/pdf/:companyId/:reportType/:startDate/:endDate` con ValidateCompanyGuard
- [ ] Crear `GET /reports/excel/:companyId/:exportType/:startDate/:endDate` con ValidateCompanyGuard
- [ ] Crear `GET /reports/chart/:companyId/:chartType/:metric/:startDate/:endDate` con ValidateCompanyGuard

### 7.3 MCP Tools
- [ ] Registrar herramienta `generate_pdf_report`
- [ ] Registrar herramienta `generate_excel_export`
- [ ] Registrar herramienta `generate_chart`
- [ ] Registrar herramienta `ask_with_attachment`

---

## FASE 8: Mejoras Transversales (0% Implementado)

### 8.1 WebSockets (Tiempo Real)
- [ ] Instalar `@nestjs/platform-socket.io` o `@nestjs/websockets`
- [ ] Implementar gateway para notificaciones en tiempo real
- [ ] Emitir eventos cuando se crean notificaciones

### 8.2 Paginación
- [ ] Agregar paginación a endpoints de listado (items, transactions, categories, batches)
- [ ] Query params: `?page=1&limit=20`
- [ ] Devolver `{ data: [], total, page, limit, totalPages }`

### 8.3 Redis Cache
- [ ] Instalar `@nestjs/cache-manager` + `cache-manager-redis-store`
- [ ] Cachear consultas de reporting (cash flow, margins) con TTL configurable
- [ ] Cachear listados de categorías e items (poco volátiles)

### 8.4 Hard Delete (Admin)
- [ ] Crear `DELETE /admin/companies/:companyId/hard` (borrado físico)
- [ ] Crear `DELETE /admin/users/:userId/hard` (borrado físico)
- [ ] Proteger con confirmación (query param `?confirm=true`)

---

## FASE 9: Testing y Calidad

### 9.1 Tests Existentes
- [x] Test unitario de AppController (`app.controller.spec.ts`)
- [~] Test unitario de AuthService (`auth.service.spec.ts` — verificar si existe)
- [x] Test unitario de CompanyController (`company.controller.spec.ts`)
- [x] Test unitario de CategoryService (`category.service.spec.ts`)
- [x] Test unitario de ItemService (`item.service.spec.ts`)
- [x] Test unitario de TransactionService (`transaction.service.spec.ts`)
- [x] Test unitario de CashFlowService (`cash-flow.service.spec.ts`)
- [x] Test unitario de ContributionMarginService (`contribution-margin.service.spec.ts`)
- [x] Test unitario de BalancePointService (`balance-point.service.spec.ts`)
- [x] Test unitario de ValidateCompanyGuard (`validate-company.guard.spec.ts`)
- [~] Test E2E (`test/app.e2e-spec.ts`)

### 9.2 Tests Pendientes
- [ ] Tests unitarios para módulo Admin
- [ ] Tests unitarios para módulo Notifications (cron job)
- [ ] Tests unitarios para módulo Payments
- [ ] Tests unitarios para módulo Reports
- [ ] Tests unitarios para módulo Invoice Scan
- [ ] Tests unitarios para módulo Gross Profit
- [ ] Tests unitarios para módulo Net Profit
- [ ] Tests unitarios para módulo Unit Cost
- [ ] Tests unitarios para módulo Price Margin
- [ ] Tests unitarios para MCP tools nuevas

---

## RESUMEN DE ESTADO

| Fase | Total Tareas | Hechas | Pendientes | % Completado |
|------|-------------|-------|------------|-------------|
| **Fase 1: Core** | 109 | 109 | 0 | **100%** |
| **Fase 2: Admin** | 27 | 0 | 27 | **0%** |
| **Fase 3: Notificaciones** | 10 | 0 | 10 | **0%** |
| **Fase 4: Análisis Financiero** | 16 | 0 | 16 | **0%** |
| **Fase 5: Invoice Scan OCR** | 8 | 0 | 8 | **0%** |
| **Fase 6: Pagos** | 15 | 0 | 15 | **0%** |
| **Fase 7: Reportes** | 8 | 0 | 8 | **0%** |
| **Fase 8: Mejoras** | 8 | 0 | 8 | **0%** |
| **Fase 9: Testing** | 23 | ~12 | ~11 | **~52%** |
| **TOTAL** | **224** | **~121** | **~103** | **~54%** |
