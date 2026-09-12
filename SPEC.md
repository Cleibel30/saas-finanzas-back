# SaaS Finanzas Backend — SPEC

## 1. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | NestJS v11 |
| ORM | Prisma v7.8 + `@prisma/adapter-pg` |
| DB | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT ES256 vía Passport) |
| AI | Groq SDK (Llama 3.3-70b) |
| MCP | `@modelcontextprotocol/sdk` v1.16 (HTTP SSE) |
| Validación | `class-validator`, `class-transformer`, Zod |
| Seguridad | Helmet, `@nestjs/throttler` |
| Testing | Jest + Supertest |

---

## 2. Roles y Modelo de Autorización

### 2.1 Roles

Sistema con **dos roles** definidos por el enum `UserRole` en el campo `role` del modelo `User`:

| Rol | Valor en DB | Descripción |
|-----|-------------|-------------|
| **Usuario** | `USER` (default) | Puede crear compañías y operar con datos financieros propios |
| **Administrador** | `ADMIN` | Gestión global del sistema. **No puede crear compañías ni operar datos financieros propios** |

### 2.2 Reglas de Negocio

| Regla | USER | ADMIN |
|-------|------|-------|
| Crear compañías | ✅ | ❌ |
| Operar transacciones, items, categorías, lotes propias | ✅ | ❌ |
| Ver cualquier compañía del sistema | ❌ (solo propias) | ✅ (solo lectura) |
| Gestionar usuarios (suspender, ver) | ❌ | ✅ |
| Aprobar pagos BS | ❌ | ✅ |
| CRUD de planes | ❌ | ✅ |
| CRUD de categorías globales por defecto | ❌ | ✅ |
| Dashboard de estadísticas globales | ❌ | ✅ |
| Promover/degradar admins | ❌ | ✅ |

### 2.3 Guards y Suspensión

Todos los guards chequean el estado de suspensión antes de permitir el acceso:

| Guard | Ámbito | Propósito |
|-------|--------|-----------|
| `JwtAuthGuard` | Global (`APP_GUARD`) | Verifica JWT de Supabase + **chequea que `User.isSuspended === false`**. Si el usuario está suspendido → `401 Unauthorized: "Cuenta suspendida"` |
| `AdminGuard` | Controladores `/admin/*` | Verifica que `user.role === 'ADMIN'` |
| `ValidateCompanyGuard` | Por ruta user | Verifica ownership `userId → companyId` + **chequea que `Company.isSuspended === false`**. Si la compañía está suspendida → `401 Unauthorized: "Compañía suspendida"` |
| `ThrottlerGuard` | Global | Rate limiting |

**Flujo de suspensión:**
1. Admin suspende usuario (`PATCH /admin/users/:id/suspend` → `isSuspended = true`)
2. El usuario no puede iniciar sesión ni hacer ninguna request (JwtAuthGuard lo rechaza)
3. Admin restaura usuario (`PATCH /admin/users/:id/restore` → `isSuspended = false`)
4. Análogamente para compañías: admin suspende/restaura, ValidateCompanyGuard bloquea el acceso

**Un usuario suspendido NO puede:**
- Hacer login (JwtAuthGuard rechaza)
- Acceder a ningún endpoint protegido
- Operar sus compañías

**Una compañía suspendida NO permite:**
- Crear/editar/eliminar transacciones, items, categorías, lotes
- Generar reportes o análisis financieros
- Usar el chat financiero

**Endpoints públicos** (decorador `@Public()`): `GET /`, `POST /auth/register`, `POST /auth/login`, `POST /admin/auth/register`, `POST /admin/auth/login`.

### 2.4 Endpoints de Autenticación de Admin

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /admin/auth/register` | Público | Registro con `admin_secret_key` extra (debe coincidir con env var). Crea User + asigna `role: ADMIN` |
| `POST /admin/auth/login` | Público | Login normal + verifica `role === 'ADMIN'`. Si es USER → `403 Forbidden` |
| `GET /admin/auth/profile` | JWT + Admin | Perfil del admin |

**El admin NO puede usar los endpoints de auth de usuario normal para obtener contexto admin.** Es decir:
- `POST /auth/login` con credenciales de admin → devuelve token pero **sin** contexto admin (el front no debe mostrar panel admin)
- `POST /admin/auth/login` con credenciales de admin → devuelve token + `isAdmin: true`

---

## 3. Entidades (Modelo de Datos)

### User
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | String | |
| `email` | String | Unique |
| `passwordHash` | String? | Opcional (Supabase maneja hash) |
| `role` | `UserRole` | `USER` (default) o `ADMIN` |
| `tokenBalance` | Int | Default 0 |
| `isSuspended` | Boolean | Default `false`. Impide login y acceso a cualquier endpoint |
| `suspendedAt` | DateTime? | Fecha de suspensión |
| `isRemoved` | Boolean | Soft delete |
| `createdAt` | DateTime | |

Relations: `companies: Company[]`, `subscriptions: Subscription[]`

### Plan
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | String | |
| `maxCompanies` | Int | |
| `price` | Decimal(10,2) | |
| `isPremium` | Boolean | |
| `isRemoved` | Boolean | |

Relations: `subscriptions: Subscription[]`

### Subscription
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `userId` | UUID | FK → User |
| `planId` | UUID | FK → Plan |
| `status` | `SubscriptionStatus` | `ACTIVE`, `EXPIRED`, `CANCELLED` |
| `endDate` | DateTime | |
| `isRemoved` | Boolean | |

### Company
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `userId` | UUID | FK → User (dueño) |
| `name` | String | |
| `isSuspended` | Boolean | Default `false`. Bloquea el acceso a la compañía |
| `suspendedAt` | DateTime? | Fecha de suspensión |
| `isRemoved` | Boolean | Soft delete |
| `createdAt` | DateTime | |

Relations: `categories: Category[]`, `items: Item[]`, `productionBatches: ProductionBatch[]`, `transactions: Transaction[]`

### Category
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID? | FK → Company (nullable: defaults globales) |
| `name` | String | |
| `type` | `CategoryType` | `OPERATING`, `INVESTING`, `FINANCING` |
| `flowDirection` | `FlowDirection` | `INFLOW`, `OUTFLOW` |
| `isCogs` | Boolean | Indica si es costo de venta |
| `isVariable` | Boolean | Indica si es costo variable |
| `isDefault` | Boolean | Default global del sistema |
| `isRemoved` | Boolean | |

Relations: `transactions: Transaction[]`

### Item
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `name` | String | |
| `type` | `ItemType` | `PRODUCT`, `SERVICE` |
| `basePrice` | Decimal(10,2) | |
| `stockCurrent` | Int | Default 0 |
| `isRemoved` | Boolean | |

Relations: `productionBatches: ProductionBatch[]`, `transactions: Transaction[]`

### ProductionBatch
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `itemId` | UUID | FK → Item |
| `quantity` | Int | |
| `status` | `BatchStatus` | `OPEN`, `CLOSED` |
| `batchDate` | DateTime | |
| `isRemoved` | Boolean | |

Relations: `transactions: Transaction[]`

### Transaction
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `categoryId` | UUID | FK → Category |
| `itemId` | UUID? | FK → Item (nullable: gastos generales) |
| `batchId` | UUID? | FK → ProductionBatch (nullable) |
| `quantity` | Int? | |
| `unitPrice` | Decimal(10,2)? | |
| `dollarRate` | Decimal(10,2) | Tasa del día |
| `amountUSD` | Decimal(10,2) | |
| `amountBs` | Decimal(10,2) | |
| `status` | `TransactionStatus` | `PENDING`, `COMPLETED` |
| `paymentMethod` | `PaymentMethod` | 8 valores (Pago móvil, tarjeta, transferencia, efectivo BS, efectivo USD, transferencias internacionales, billeteras electrónicas, cripto) |
| `currency` | `Currency` | `BOLIVARES`, `DOLARES` |
| `paymentReference` | String? | |
| `description` | String? | |
| `stockEffect` | `StockEffect` | `INCREMENT`, `DECREMENT`, `NONE` |
| `paymentDate` | DateTime? | |
| `isRemoved` | Boolean | |

### Notification
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `type` | `NotificationType` | `PAYMENT_DUE`, `PAYMENT_COMPLETED`, `STOCK_LOW`, `BATCH_CLOSED`, `SYSTEM` |
| `title` | String | |
| `message` | String | |
| `referenceId` | String? | ID de transacción, batch, etc. |
| `isRead` | Boolean | Default `false` |
| `isRemoved` | Boolean | |
| `createdAt` | DateTime | |

Relations: `N:1 company → Company`

### Payment
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `userId` | UUID | FK → User |
| `planId` | UUID | FK → Plan |
| `amountUSD` | Decimal(10,2) | |
| `amountBs` | Decimal(10,2)? | Solo si pago en BS |
| `currency` | `Currency` | `BOLIVARES`, `DOLARES` |
| `provider` | `PaymentProvider` | `STRIPE`, `PAYPAL`, `BANK_TRANSFER` |
| `providerPaymentId` | String? | ID en Stripe/PayPal |
| `status` | `PaymentStatus` | `PENDING`, `COMPLETED`, `REJECTED`, `EXPIRED` |
| `receiptImageUrl` | String? | Comprobante de pago BS |
| `approvedBy` | UUID? | FK → User (admin) |
| `approvedAt` | DateTime? | |
| `isRemoved` | Boolean | |
| `createdAt` | DateTime | |

Relations: `N:1 company → Company`, `N:1 user → User`, `N:1 plan → Plan`

### Diagrama ER
```
User 1──N Company
User 1──N Subscription N──1 Plan
User 1──N Payment
Company 1──N Category
Company 1──N Item
Company 1──N ProductionBatch
Company 1──N Transaction
Company 1──N Notification
Company 1──N Payment
Category 1──N Transaction
Item 1──N ProductionBatch
Item 1──N Transaction
ProductionBatch 1──N Transaction
```

---

## 4. Módulos y Endpoints

### App (`GET /`)
- Health check público.

### Auth (`POST /auth/*`)
| Endpoint | Auth | Rate Limit | Descripción |
|----------|------|------------|-------------|
| `register` | Público | 5/60s | Crea usuario en Supabase Auth + DB local |
| `login` | Público | 10/60s | Autentica contra Supabase, devuelve JWT |
| `profile` | JWT | — | Datos del usuario autenticado |

### Company (`/company/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /create` | JWT | Crear compañía |
| `PATCH /update/:id` | JWT + Company | Actualizar nombre |
| `GET /my-companies` | JWT | Listar compañías del usuario |
| `GET /:id` | JWT + Company | Obtener compañía por ID |

### Category (`/category/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /create/:companyId` | JWT + Company | Crear categoría |
| `GET /list/:companyId` | JWT + Company | Listar categorías (incluye defaults globales) |
| `POST /delete/:companyId/:categoryId` | JWT + Company | Soft delete |
| `POST /update/:companyId/:categoryId` | JWT + Company | Actualizar categoría |
| `GET /get-by-name/:name/:companyId` | JWT + Company | Búsqueda fuzzy por nombre |

### Item (`/item/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /create/:companyId` | JWT + Company | Batch create (array) |
| `PATCH /update/:itemId/:companyId` | JWT + Company | Actualizar item |
| `GET /get-all/:companyId` | JWT + Company | Listar todos |
| `DELETE /delete/:itemId/:companyId` | JWT + Company | Soft delete |
| `GET /get-by-name/:name/:companyId` | JWT + Company | Búsqueda fuzzy |
| `GET /get-all-products/:companyId` | JWT + Company | Solo productos |
| `GET /get-all-services/:companyId` | JWT + Company | Solo servicios |

### Transaction (`/transaction/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /create/:companyId` | JWT + Company | Bulk create (decrementa stock si aplica) |
| `GET /get-all/:companyId` | JWT + Company | Listar todas con filtros combinables + paginación |
| `GET /get-by-id/:companyId/:transactionId` | JWT + Company | Por ID |
| `PATCH /update/:companyId/:transactionId` | JWT + Company | Actualizar (valida FKs, recalcula montos) |
| `DELETE /delete/:companyId/:transactionId` | JWT + Company | Soft delete |

**`GET /get-all/:companyId`** — Lista transacciones de la empresa con filtros opcionales combinables (AND) y paginación. Respuesta: `{ data, meta }`.

Query params:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | number (≥1) | Página, default `1` |
| `limit` | number (1–500) | Tamaño de página, default `50` |
| `startDate` | string `YYYY-MM-DD` | Filtra `paymentDate >= startDate` (inicio de día) |
| `endDate` | string `YYYY-MM-DD` | Filtra `paymentDate <= endDate` (fin de día) |
| `categoryId` | UUID | Filtra por categoría |
| `status` | `PENDING \| COMPLETED` | Filtra por estado |
| `itemId` | UUID | Filtra por ítem |

Reglas:
- Si `startDate` y `endDate` vienen juntos, se valida `startDate <= endDate`.
- Los filtros se combinan con AND; si no se pasa ninguno, devuelve todas las transacciones activas paginadas.
- Respuesta paginada: `{ data: Transaction[], meta: { page, limit, total, totalPages } }`.
- Los endpoints `get-by-date-range`, `get-by-date-category`, `get-by-status` y `get-by-item` quedaron deprecados en favor de `get-all` con query params.

### Production Batch (`/production-batch/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /create/:companyId/:itemId` | JWT + Company | Crear lote con transacciones (decrementa stock si inflow) |
| `GET /get-all/:companyId` | JWT + Company | Listar lotes |
| `GET /get-all-by-product/:companyId/:itemId` | JWT + Company | Lotes por producto |
| `GET /get-all-by-batch-id/:companyId/:batchId` | JWT + Company | Lote por ID |
| `PATCH /update/:companyId/:batchId` | JWT + Company | Actualizar lote |
| `PATCH /delete/:companyId/:batchId` | JWT + Company | Soft delete |

### Cash Flow (`/cash-flow/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /total-cashflow/:companyId` | JWT + Company | Resumen global (balance USD/BS, pendientes, flujo por tipo) |
| `GET /cashflow/:companyId/:startDate/:endDate` | JWT + Company | Flujo de caja por rango de fechas |

### Contribution Margin (`/contribution-margin/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /global/:companyId/:startDate/:endDate` | JWT + Company | Margen de contribución global (ventas - costos variables) |
| `GET /product-global/:itemId/:companyId/:startDate/:endDate` | JWT + Company | Margen por producto (considera lotes de producción) |
| `GET /product/:batchId/:companyId` | JWT + Company | Margen por lote específico |
| `GET /service/:itemId/:companyId/:startDate/:endDate` | JWT + Company | Margen por servicio (sin lotes) |

### Balance Point (`/balance-point/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /:companyId/:startDate/:endDate` | JWT + Company | Punto de equilibrio global: Costos Fijos / Ratio MC Global |
| `GET /product/:itemId/:companyId/:startDate/:endDate` | JWT + Company | Punto de equilibrio por producto (costos fijos asignados proporcionalmente) |
| `GET /batch/:batchId/:companyId` | JWT + Company | Punto de equilibrio por lote de producción (costos fijos asignados proporcionalmente) |
| `GET /service/:itemId/:companyId/:startDate/:endDate` | JWT + Company | Punto de equilibrio por servicio (costos fijos asignados proporcionalmente) |

#### Respuesta de `breakEven`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `breakEvenStatus` | `'no_sales' \| 'negative_margin' \| 'safe' \| 'at_risk'` | Estado del punto de equilibrio. `no_sales` = sin ventas en el período. |
| `dataConfidence` | `'insufficient' \| 'estimated' \| 'low' \| 'medium' \| 'high'` | Confianza del cálculo según cantidad de transacciones INFLOW. |
| `transactionCount` | `number` | Cantidad de transacciones INFLOW del período (usado para determinar `dataConfidence`). |
| `salesVolumeRequired` / `salesVolumeRequiredBs` | `number \| null` | Ventas mínimas en monto para cubrir costos. `null` = margen negativo o sin ventas. |
| `unitsRequired` / `unitsRequiredBs` | `number \| null` | Unidades mínimas a vender para alcanzar el punto de equilibrio. `null` = margen negativo o sin datos. |
| `isEstimated` | `boolean` | `true` si el BEP fue estimado usando `basePrice` (sin ventas reales). `false` si usa ratio MC real. |
| `isSafe` | `boolean \| null` | `true` si ventas ≥ BEP. `null` si `breakEvenStatus = 'no_sales'`. `false` si por debajo. |
| `isSafeUsd` / `isSafeBs` | `boolean` | Seguridad **por moneda**: ventas de esa moneda ≥ su propio equilibrio (y margen > 0). |
| `distanceToBreakEven` / `distanceToBreakEvenBs` | `number \| null` | Ventas actuales − equilibrio. Positivo = por encima; negativo = por debajo; `null` = sin ventas o margen negativo. |
| `distanceToBreakEvenUnits` | `number \| null` | Unidades vendidas − unidades de equilibrio. Positivo = por encima; negativo = por debajo; `null` = sin datos. |
| `marginStatus` | `'negative' \| 'safe' \| 'at_risk' \| 'no_sales'` | Estado del margen. `no_sales` = sin ventas registradas. |
| `marginStatusUsd` / `marginStatusBs` | `'negative' \| 'safe' \| 'at_risk'` | Estado por moneda. |

#### Lógica de `dataConfidence`

| Valor | Cantidad de transacciones INFLOW | BEP calculado |
|-------|--------------------------------|---------------|
| `insufficient` | 0 | `null` (sin datos para estimar) |
| `estimated` | 0 pero hay `basePrice` en el ítem | Estimado con `basePrice` y costos variables registrados |
| `low` | 1-4 | Ratio MC real (poco confiable, puede variar mucho) |
| `medium` | 5-19 | Ratio MC real (razonable) |
| `high` | 20+ | Ratio MC real (confiable) |

#### Estimación de BEP sin ventas

Para **producto**, **lote** y **servicio**: cuando `transactionCount = 0` y el ítem tiene `basePrice`, se calcula un BEP estimado:

```
MC Unitario Estimado = basePrice - Costo Variable Unitario (de costos registrados)
Ratio MC Estimado = MC Unitario / basePrice
BEP Estimado = Costos Fijos Asignados / Ratio MC Estimado
```

El campo `isEstimated: true` indica que el BEP es una **estimación**, no un cálculo con ventas reales. Se actualizará con las primeras ventas.

Para el endpoint **global**: no se estima BEP cuando no hay ventas (la información no sería precisa por la mezcla de múltiples productos con diferentes precios).

#### Causa real de divergencias USD/Bs (documentado para el frontend)

`amountUSD` y `amountBs` se guardan por transacción con un `dollarRate` del día, que **varía entre registros**. Por eso las tasas implícitas difieren por categoría, p. ej. ventas ~756 Bs/USD vs costos fijos ~771 Bs/USD. Cuando el margen de seguridad es marginal, esto hace que **una moneda diga "safe" y la otra "at_risk"** (distancias con signos opuestos). No es un bug del endpoint: cada moneda es aritméticamente correcta en sus propios datos. El endpoint ahora lo **expone** (campos por moneda) en lugar de ocultarlo. La solución de fondo es de datos: reconciliar los `dollarRate` de costos fijos contra la tasa de ventas del período.

### Finance Chat (`/finance-chat/*`)
| Endpoint | Auth | Rate Limit | Descripción |
|----------|------|------------|-------------|
| `POST /ask/:companyId` | JWT + Company | 30/60s | Pregunta financiera en lenguaje natural → IA |

---

### Admin (`/admin/*`)

#### Auth (`/admin/auth/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `register` | Público | Registro con `admin_secret_key`. Crea User con `role: ADMIN` |
| `login` | Público | Login + verifica `role === 'ADMIN'`. 403 si no es admin |
| `profile` | JWT + Admin | Perfil del admin autenticado |

#### Users (`/admin/users/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /` | Admin | Listar usuarios (paginado, búsqueda). Filtro: `?suspended=true` solo suspendidos |
| `GET /:userId` | Admin | Ver detalle del usuario + sus compañías + plan + estado suspensión |
| `PATCH /:userId/suspend` | Admin | Suspender usuario (`isSuspended = true`, impide cualquier request) |
| `PATCH /:userId/restore` | Admin | Restaurar usuario (`isSuspended = false`) |
| `PATCH /:userId/role` | Admin | Cambiar role (promover/demover admin) |

#### Companies (`/admin/companies/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /` | Admin | Listar compañías (con dueño, plan). Filtro: `?suspended=true` solo suspendidas |
| `GET /:companyId` | Admin | Ver detalle financiero de la compañía (solo lectura) + estado suspensión |
| `PATCH /:companyId/suspend` | Admin | Suspender compañía (`isSuspended = true`, bloquea cualquier operación) |
| `PATCH /:companyId/restore` | Admin | Restaurar compañía (`isSuspended = false`) |

#### Payments (`/admin/payments/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /` | Admin | Todos los pagos (filtros: status, provider, rango fecha) |
| `GET /pending-bs` | Admin | Pagos BS pendientes de aprobación con enlace al comprobante |
| `PATCH /:paymentId/approve` | Admin | Aprobar pago BS (crea/actualiza Subscription) |
| `PATCH /:paymentId/reject` | Admin | Rechazar pago BS con motivo |

#### Plans (`/admin/plans/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /` | Admin | Crear plan |
| `GET /` | Admin | Listar planes |
| `PATCH /:planId` | Admin | Actualizar plan (precio, límites) |
| `DELETE /:planId` | Admin | Soft delete (solo si no hay suscripciones activas) |

#### Categories (`/admin/categories/default/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /` | Admin | Crear categoría global (`isDefault: true`, `companyId: null`) |
| `GET /` | Admin | Listar categorías globales |
| `PATCH /:categoryId` | Admin | Editar categoría global |
| `DELETE /:categoryId` | Admin | Soft delete |

#### Stats (`/admin/stats/*`)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /` | Admin | KPIs: usuarios totales, compañías activas, transacciones totales, ingresos |
| `GET /revenue` | Admin | Ingresos por mes agrupados por plan |
| `GET /users-growth` | Admin | Nuevos usuarios por mes |
| `GET /active-companies` | Admin | Compañías activas vs suspendidas |

---

## 5. Flujos de Negocio Clave

### 5.1 Registro y Autenticación

#### Usuario Normal
1. `POST /auth/register` valida `password === repeat_password`, verifica email único, crea usuario en Supabase Auth y replica en DB local con `role: USER`.
2. `POST /auth/login` autentica contra Supabase, devuelve `access_token` + `{ user, isAdmin: false }`.

#### Administrador
1. `POST /admin/auth/register` — igual que el registro normal, pero **requiere** `admin_secret_key` en el body:
   ```json
   { "name": "...", "email": "...", "password": "...", "repeat_password": "...", "admin_secret_key": "..." }
   ```
   - Si `admin_secret_key !== ADMIN_SECRET_KEY` (env var) → `401 Unauthorized`
   - Si coincide → crea User en Supabase + DB local con `role: ADMIN`
2. `POST /admin/auth/login` — autentica contra Supabase, luego verifica `user.role === 'ADMIN'`:
   - Si el usuario existe pero no es admin → `403 Forbidden`
   - Si es admin → devuelve `{ access_token, user, isAdmin: true }`
3. El token JWT incluye `role` en el payload para que los guards (y el front) sepan el rol sin consultar DB.

**Peticiones subsiguientes**: `Authorization: Bearer <token>`. El `JwtAuthGuard` valida el token contra la clave pública de Supabase. El `AdminGuard` verifica `payload.role === 'ADMIN'` para rutas `/admin/*`.

### 5.2 Multi‑moneda
Toda transacción almacena ambos montos:
- Si `currency = DOLARES`: `amountUSD = amount`, `amountBs = amount * dollarRate`
- Si `currency = BOLIVARES`: `amountUSD = amount / dollarRate`, `amountBs = amount`

### 5.3 Control de Stock (Items tipo PRODUCT)
- El campo `stockEffect` en la transacción determina explícitamente el efecto en inventario:
  - `INCREMENT` → suma `quantity` a `stockCurrent`
  - `DECREMENT` → resta `quantity` a `stockCurrent`
  - `NONE` → no afecta stock
- Solo aplica a Items `PRODUCT`. Los `SERVICE` nunca afectan stock.
- La validación de stock suficiente ocurre **antes** de la escritura en base (dentro de una transacción Prisma).

### 5.4 Categorías por Defecto
El endpoint `GET /category/list/:companyId` retorna las categorías propias de la compañía **más** aquellas con `isDefault: true` (categorías globales del sistema sin `companyId`).

### 5.4.1 Scope de Categoría (`itemType`)
Cada categoría tiene un campo `itemType` (`CategoryItemScope`) que indica qué tipo de ítem acepta:

| Valor | Descripción | Ejemplo |
|-------|-------------|---------|
| `PRODUCT` | Solo acepta ítems tipo PRODUCT | "Venta de producto", "Materia prima" |
| `SERVICE` | Solo acepta ítems tipo SERVICE | "Venta de servicio", "Consultoría" |
| `NONE` | No requiere ítem (default) | "Alquiler", "Servicios públicos" |

**Validación en transacciones**: Al crear o actualizar una transacción, si la categoría tiene `itemType != NONE`, se valida que el `itemId` sea del tipo correcto. Si no coincide, se lanza `400 Bad Request` con un mensaje descriptivo.

### 5.5 Búsqueda Difusa (Fuzzy Search)
Estrategia de dos niveles:
1. Función PostgreSQL `search_item_fuzzy` / `search_category_fuzzy` (usa `pg_trgm` + `similarity()`).
2. Fallback a Prisma `{ name: { contains, mode: 'insensitive' } }` con `take: 20`.

### 5.6 Análisis Financiero

#### Margen de Contribución
- **Global**: `Ventas (INFLOW completed) - Costos Variables (OUTFLOW + isVariable, completed)` → ratio = margen / ventas.
- **Por Producto**: Ventas del producto - (unidades vendidas × costo unitario promedio de lotes en el período).
- **Por Lote**: Ingresos del lote - costos variables del lote.
- **Por Servicio**: Ventas del servicio - costos variables directamente asociados (sin lotes).

#### Punto de Equilibrio
`Break-Even (USD) = Costos Fijos / Ratio de Margen de Contribución Global`
Donde:
- Costos Fijos = suma de transacciones `OUTFLOW + isVariable = false + completed`.
- Ratio MC = Margen de Contribución Global / Ventas Totales.

### 5.7 IA y Chat Financiero
1. `POST /finance-chat/ask/:companyId` recibe `{ preguntaUsuario }`.
2. El `GroqAgentService` procesa en 4 etapas:
   - **Chain Detection**: Detecta consultas compuestas ("margen del producto X en este mes") y las resuelve determinísticamente (busca IDs, ejecuta la herramienta objetivo).
   - **Direct Planning**: Regex para consultas simples ("listar productos", "stock actual").
   - **Keyword Inference**: Mapa de palabras clave → herramientas probables.
   - **Groq LLM Fallback**: Si nada anterior matchea, envía la pregunta a Groq con definiciones de herramientas y ejecuta los tool calls que el modelo decida.
3. La respuesta se formatea como texto estructurado con bloques JSON.

### 5.8 MCP (Model Context Protocol)
- Servidor HTTP SSE deshabilitado por defecto (`MCP_HTTP_ENABLED=false`).
- Expone **22 herramientas financieras** actuales (márgenes, punto de equilibrio, búsquedas, cash flow, lotes, transacciones).
- Usa `AsyncLocalStorage` para mantener el contexto de tenant (`companyId`, `userId`) por sesión SSE, evitando fuga de datos entre usuarios.
- **Próximamente**: herramientas para generación de PDF, Excel exportable, y gráficos automáticos vía IA (ver sección 5.13).

### 5.9 Nuevas Funciones de Análisis Financiero

#### 5.9.1 Utilidad Bruta (Gross Profit)
```
Utilidad Bruta = Ventas Netas - Costo de Venta (COGS)
```
- **Ventas Netas**: Suma de transacciones `INFLOW + COMPLETED` en el período.
- **COGS**: Suma de transacciones `OUTFLOW + isCogs = true + COMPLETED`.
- Se puede calcular **global** (toda la compañía), **por producto** (ventas del producto - costo de lotes vendidos), o **por servicio**.
- Endpoints propuestos:
  - `GET /gross-profit/global/:companyId/:startDate/:endDate`
  - `GET /gross-profit/product/:itemId/:companyId/:startDate/:endDate`
  - `GET /gross-profit/service/:itemId/:companyId/:startDate/:endDate`

#### 5.9.2 Utilidad Neta (Net Profit)
```
Utilidad Neta = Utilidad Bruta - Gastos Operativos - Gastos de Inversión - Gastos Financieros
```
- Desglose por `CategoryType`:
  - `OPERATING`: Gastos operativos (sueldos, alquiler, servicios, etc.)
  - `INVESTING`: Gastos de inversión (activos fijos, equipos, etc.)
  - `FINANCING`: Gastos financieros (intereses, comisiones, etc.)
- Endpoints propuestos:
  - `GET /net-profit/:companyId/:startDate/:endDate` — estado de resultados completo
  - `GET /net-profit/statement/:companyId/:startDate/:endDate` — reporte tipo P&L estructurado con Ventas → Utilidad Bruta → Utilidad Neta

#### 5.9.3 Costo Total Unitario
```
Costo Total Unitario = (Costo de Materiales + Costos de Mano de Obra + Costos Indirectos) / Cantidad Producida
```
- Por **lote de producción**: suma de transacciones `OUTFLOW` del batch dividido entre `quantity` del batch.
- Por **producto (promedio ponderado)**: promedio ponderado del costo unitario de todos los lotes `CLOSED` en el período.
- Endpoints propuestos:
  - `GET /unit-cost/batch/:batchId/:companyId` — costo unitario de un lote específico
  - `GET /unit-cost/product/:itemId/:companyId` — costo unitario promedio histórico del producto (según último lote cerrado o promedio ponderado)

#### 5.9.4 Precio con Margen Real
```
Precio con Margen Real = Costo Total Unitario / (1 - Margen Objetivo)
Precio con Margen Real = Costo Total Unitario * (1 + Porcentaje de Margen)
```
- Toma el costo unitario de un producto y calcula el precio de venta necesario para alcanzar un margen objetivo.
- Endpoints propuestos:
  - `POST /price/margin-target/:companyId` — body: `{ itemId, targetMarginPercent }` → precio recomendado

### 5.10 Escaneo de Facturas (OCR)

#### Descripción
Endpoint que recibe una imagen de factura (foto o PDF escaneado), la procesa con IA (OCR + LLM) y devuelve una estructura de transacciones lista para ser revisada por el usuario.

**No guarda nada en base de datos.** Solo devuelve la información extraída.

#### Endpoint Propuesto
```
POST /invoice-scan/parse/:companyId
```
- **Auth**: JWT + ValidateCompanyGuard
- **Input**: `multipart/form-data` con archivo de imagen (jpg, png, webp) o PDF
- **Output**: `{ transactions: ExtractedTransaction[], rawText: string }`

#### Flujo
1. Servicio de OCR (Gemini Vision API, GPT-4o, o Tesseract + Groq) extrae texto de la imagen.
2. LLM estructurador parsea el texto en una lista de objetos que mapean al schema de `CreateTransactionDto`:
   ```json
   [
     {
       "categoryName": "Materia Prima",
       "itemName": "Harina PAN",
       "amount": 45.50,
       "currency": "DOLARES",
       "dollarRate": 80.50,
       "paymentMethod": "EFECTIVO_DIVISAS",
       "description": "Factura Proveedor XYZ #00123",
       "paymentDate": "2026-06-01",
       "quantity": 10,
       "unitPrice": 4.55,
       "flowDirection": "OUTFLOW",
       "status": "COMPLETED"
     }
   ]
   ```
3. El frontend recibe los datos, los muestra al usuario para confirmación/edición, y el usuario decide si procede a guardar via `POST /transaction/create/:companyId`.

#### Validaciones
- Los campos `categoryName` e `itemName` se resuelven contra la DB de la compañía (búsqueda fuzzy). Si no existen, se devuelven como sugerencias de texto libre.
- Si la moneda de la factura está en BS, se puede usar un servicio de tasa de cambio (BCV API) para calcular `dollarRate`.

### 5.11 Notificaciones y Auto-Completado de Transacciones

#### Nueva Entidad: Notification
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `type` | `NotificationType` | `PAYMENT_DUE`, `PAYMENT_COMPLETED`, `STOCK_LOW`, `BATCH_CLOSED`, `SYSTEM` |
| `title` | String | Título de la notificación |
| `message` | String | Cuerpo del mensaje |
| `referenceId` | String? | ID de la entidad relacionada (transactionId, batchId, etc.) |
| `isRead` | Boolean | Default `false` |
| `isRemoved` | Boolean | |
| `createdAt` | DateTime | |

Relations:
- N:1 `company` → Company

#### Flujo de Auto-Completado
1. **Cron job** (`@nestjs/schedule`) se ejecuta cada 5 minutos (configurable).
2. Busca transacciones con:
   - `status = PENDING`
   - `paymentDate <= NOW()`
   - Category `type = OPERATING`
3. Para cada transacción encontrada:
   - Actualiza `status → COMPLETED`
   - Crea una `Notification` asociada a la compañía:
     - `type: PAYMENT_COMPLETED`
     - `title`: "Pago completado automáticamente"
     - `message`: `"La transacción {description} por {amountUSD} USD ha sido completada según su fecha de pago."`
     - `referenceId`: transaction.id
4. **Notificación en tiempo real** (opcional): Socket.IO o Server-Sent Events para notificar al frontend.

#### Endpoints Propuestos
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /notifications/list/:companyId` | JWT + Company | Listar notificaciones |
| `PATCH /notifications/read/:companyId/:notificationId` | JWT + Company | Marcar como leída |
| `GET /notifications/unread-count/:companyId` | JWT + Company | Contador de no leídas |

### 5.12 Sistema de Pagos (Stripe / PayPal / Comprobante BS)

#### Modelo de Datos

**Nueva entidad: Payment**
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `companyId` | UUID | FK → Company |
| `userId` | UUID | FK → User |
| `planId` | UUID | FK → Plan |
| `amountUSD` | Decimal(10,2) | |
| `amountBs` | Decimal? | Solo si pago en BS |
| `currency` | `Currency` | `BOLIVARES` o `DOLARES` |
| `provider` | `PaymentProvider` | `STRIPE`, `PAYPAL`, `BANK_TRANSFER` |
| `providerPaymentId` | String? | ID de la transacción en Stripe/PayPal |
| `status` | `PaymentStatus` | `PENDING`, `COMPLETED`, `REJECTED`, `EXPIRED` |
| `receiptImageUrl` | String? | URL del comprobante de pago (S3/Cloudinary) |
| `approvedBy` | UUID? | FK → User (admin que aprobó) |
| `approvedAt` | DateTime? | |
| `createdAt` | DateTime | |

#### Flujo de Pago en USD (Stripe / PayPal)

```
Frontend → Stripe/Paypal Checkout → Webhook → Backend
```
1. **Backend** (`POST /payment/create-intent`): Crea un Payment Intent en Stripe (o similar en PayPal) y lo asocia a un plan.
2. **Frontend**: Redirige al checkout de Stripe/PayPal.
3. **Webhook** (`POST /payment/webhook/stripe`): Stripe/PayPal notifica al backend del éxito del pago.
4. Backend actualiza `Payment.status = COMPLETED`, registra `providerPaymentId`, crea/renueva la `Subscription` asociada.
5. Se genera una `Notification` de confirmación.

#### Flujo de Pago en BS (Comprobante Bancario)

```
Frontend → Upload receipt → Backend → Admin Approval → Confirmación
```
1. **Frontend**: Usuario sube foto/PDF del comprobante de transferencia bancaria.
2. **Backend** (`POST /payment/upload-receipt`):
   - Recibe `multipart/form-data` con el archivo.
   - Sube el archivo a supabase.
   - Crea un `Payment` con `status = PENDING`, `receiptImageUrl`.
   - Notifica al admin vía `Notification`.
3. **Admin** (`PATCH /payment/approve/:paymentId`):
   - Admin revisa el comprobante.
   - Aprueba → `status = COMPLETED`, crea/actualiza `Subscription`.
   - Rechaza → `status = REJECTED`, notifica al usuario.

#### Endpoints Propuestos

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /payment/create-intent` | JWT | Crear Payment Intent Stripe/PayPal |
| `POST /payment/webhook/stripe` | Público (firma) | Webhook de Stripe |
| `POST /payment/webhook/paypal` | Público (firma) | Webhook de PayPal |
| `POST /payment/upload-receipt` | JWT | Subir comprobante de pago en BS |
| `PATCH /payment/approve/:paymentId` | JWT + Admin | Admin aprueba/rechaza pago |
| `GET /payment/list-pending/:companyId` | JWT + Company | Pagos pendientes del usuario |
| `GET /payment/list-all-pending` | JWT + Admin | Todos los pagos pendientes (admin) |

### 5.13 Nuevas Herramientas MCP para IA (PDF, Excel, Gráficos)

Se agregan **5 nuevas herramientas** al servidor MCP (`McpService`) que permiten a la IA generar documentos y visualizaciones a partir de datos financieros.

#### Herramientas Propuestas

| # | Tool Name | Descripción | Input | Output |
|---|-----------|-------------|-------|--------|
| 1 | `generate_pdf_report` | Genera un PDF con reporte financiero completo | `{ reportType: "pnl" | "cashflow" | "margins", startDate, endDate, companyName }` | URL del PDF generado |
| 2 | `generate_excel_export` | Genera archivo Excel con datos financieros | `{ exportType: "transactions" | "margins" | "inventory" | "full", startDate, endDate }` | URL del Excel generado |
| 3 | `generate_chart` | Genera gráfico automático de los datos solicitados | `{ chartType: "bar" | "line" | "pie", metric: "sales" | "costs" | "margins" | "cashflow", startDate, endDate }` | URL del chart (SVG/PNG) |
| 4 | `ask_with_attachment` | Chat + adjunto (imagen/PDF de factura) para extraer datos | `{ question, fileUrl }` | Texto explicativo + datos estructurados |
| 5 | `get_net_profit` | Utilidad neta completa (P&L) | `{ startDate, endDate }` | JSON con Ventas → Utilidad Bruta → Gastos → Utilidad Neta |

#### Estrategia de Implementación

1. **PDF**: Usar `pdfkit` o `@jsreport/nodejs-client` en un nuevo servicio `ReportService`. La IA selecciona la herramienta `generate_pdf_report`, el backend recolecta los datos y renderiza el PDF.
2. **Excel**: Usar `exceljs` para generar `.xlsx` con formato profesional (tablas, colores, cabeceras). La IA decide qué datos incluir.
3. **Gráficos**: Usar `chart.js` (server-side con `canvas`) o `vega-lite` para generar gráficos en SVG/PNG. Alternativa: QuickChart.io como API externa.
4. **Archivos generados**: Se almacenan en S3/Cloudinary o en un directorio `generated/` con URLs efímeras (expiración configurable).
5. **Integración con MCP**: Cada herramienta tiene su schema Zod y manejador que llama al `ReportService`.

#### Endpoints REST Propuestos (para descarga directa)
| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /reports/pdf/:companyId/:reportType/:startDate/:endDate` | JWT + Company | Descargar PDF |
| `GET /reports/excel/:companyId/:exportType/:startDate/:endDate` | JWT + Company | Descargar Excel |
| `GET /reports/chart/:companyId/:chartType/:metric/:startDate/:endDate` | JWT + Company | Obtener gráfico |

---

## 6. Seguridad

- **Helmet** activado globalmente.
- **CORS** configurable vía `FRONTEND_URL` (soporta múltiples orígenes separados por coma).
- **Rate limiting**: 120 req/60s global, con throttles específicos en auth (5/login, 10/register) y chat (30).
- **Validación**: `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform`.
- **Soft deletes**: Todas las entidades usan `isRemoved` en lugar de borrado físico.
- **JWT ES256**: Verificado contra claves EC P-256 de Supabase (`SUPABASE_JWT_JWK_X`, `SUPABASE_JWT_JWK_Y`).
- **Aislamiento por tenant**: `ValidateCompanyGuard` + `mcpTenantContext` (AsyncLocalStorage) garantizan que un usuario solo acceda a datos de sus propias compañías.

---

## 7. Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | Pooled connection (puerto 6543) |
| `DIRECT_URL` | Sí | Conexión directa para migraciones (puerto 5432) |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Sí | Anon key de Supabase |
| `SUPABASE_JWT_JWK_X` | Sí | Coordenada X de clave pública EC P-256 |
| `SUPABASE_JWT_JWK_Y` | Sí | Coordenada Y de clave pública EC P-256 |
| `SUPABASE_JWT_ISSUER` | No | Emisor JWT (default: `{SUPABASE_URL}/auth/v1`) |
| `SUPABASE_JWT_AUDIENCE` | No | Audiencia JWT (default: `authenticated`) |
| `FRONTEND_URL` | No | Orígenes CORS (separados por coma) |
| `GROQ_API_KEY` | No | API key de Groq (sin ella, chat deshabilitado) |
| `MCP_HTTP_ENABLED` | No | Habilitar MCP HTTP SSE (default: `false`) |
| `PORT` | No | Puerto del servidor (default: 3000) |
| `STRIPE_SECRET_KEY` | No | API Key secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | No | Firma de webhook de Stripe |
| `PAYPAL_CLIENT_ID` | No | Client ID de PayPal |
| `PAYPAL_CLIENT_SECRET` | No | Client Secret de PayPal |
| `PAYPAL_WEBHOOK_ID` | No | ID del webhook de PayPal |
| `CLOUDINARY_CLOUD_NAME` | No | Cloud name de Cloudinary (comprobantes) |
| `CLOUDINARY_API_KEY` | No | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | No | API Secret de Cloudinary |
| `GEMINI_API_KEY` | No | API Key de Gemini Vision (OCR facturas) |
| `ADMIN_SECRET_KEY` | No | Clave secreta para registrar el primer admin (seed) |

---

## 8. Estado del Proyecto

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 1 | **Modelo User con role** (`USER`/`ADMIN`) | ✅ Implementado |
| 2 | **Auth de admin** (register con `admin_secret_key` + login separado) | Pendiente |
| 3 | **Módulo Admin** (gestión usuarios, compañías, pagos, planes, categorías globales, stats) | Pendiente |
| 4 | **Utilidad Bruta** — endpoints y MCP tools (sección 5.9.1) | ✅ Implementado |
| 5 | **Utilidad Neta / P&L** — endpoint + herramienta MCP (sección 5.9.2) | ✅ Implementado |
| 6 | **Costo Total Unitario** — por lote y promedio por producto (sección 5.9.3) | ✅ Implementado |
| 7 | **Precio con Margen Real** — calculadora de precio objetivo (sección 5.9.4) | ✅ Implementado |
| 8 | **Escaneo de Facturas OCR** — endpoint de parseo sin guardar (sección 5.10) | Pendiente |
| 9 | **Notificaciones** — entidad, endpoints, cron job de auto-completado (sección 5.11) | Pendiente |
| 10 | **Pagos Stripe/PayPal** — intents + webhooks (sección 5.12) | Pendiente |
| 11 | **Pagos BS con comprobante** — upload + aprobación admin (sección 5.12) | Pendiente |
| 12 | **Reportes PDF** — vía MCP tool + endpoint REST (sección 5.13) | Pendiente |
| 13 | **Exportación Excel** — vía MCP tool + endpoint REST (sección 5.13) | Pendiente |
| 14 | **Gráficos automáticos** — vía MCP tool + endpoint REST (sección 5.13) | Pendiente |
| 15 | **MCP tools nuevas** — 5 herramientas adicionales (sección 5.13) | Pendiente |
| 16 | **WebSockets** — notificaciones en tiempo real (Socket.IO o SSE) | Pendiente |
| 17 | **Paginación** en endpoints de listado | Pendiente |
| 18 | **Cache** (redis, etc.) | Pendiente |
| 19 | **Hard delete** — actualmente solo soft delete | Pendiente |
| 20 | **Módulo de suscripciones** — CRUD de Plan/Subscription, lógica de facturación | Pendiente |
