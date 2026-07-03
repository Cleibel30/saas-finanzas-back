# DESIGN — Arquitectura Técnica del Backend

## 1. Filosofía Arquitectónica

El backend sigue el **patrón modular nativo de NestJS** con las siguientes capas por módulo:

```
src/<modulo>/
├── <modulo>.module.ts        → Configura el módulo (imports, providers, exports, controllers)
├── <modulo>.controller.ts    → Define rutas, decoradores HTTP, delegación al service
├── <modulo>.service.ts       → Lógica de negocio, acceso a Prisma
├── dto/
│   └── <entidad>.dto.ts      → DTOs con class-validator (validación en entrada)
├── guards/                   → Guards específicos del módulo
├── interfaces/               → Interfaces TypeScript locales
└── *.spec.ts                 → Tests unitarios (Jest)
```

---

## 2. Módulos Existentes (14 módulos)

```
src/
├── prisma/           → PrismaService (singleton global del ORM)
├── auth/             → Autenticación Supabase JWT (register, login, profile)
├── company/          → CRUD de compañías + ValidateCompanyGuard
├── category/         → CRUD de categorías financieras + fuzzy search
├── item/             → CRUD de productos/servicios + fuzzy search + stock
├── transaction/      → CRUD de transacciones + lógica multi-moneda + control stock
├── production_batch/ → CRUD de lotes de producción + transacciones atómicas
├── cash-flow/        → Reportes de flujo de caja (total + por rango)
├── contribution-margin/ → Análisis de margen de contribución (global/producto/lote/servicio)
├── balance-point/    → Cálculo de punto de equilibrio
├── mcp/              → MCP Server HTTP SSE (20 tools + aislamiento por tenant)
├── groq-agent/       → Agente IA Groq con procesamiento en 4 etapas
├── finance-chat/     → Chat financiero con IA
├── common/           → Guards globales (JwtAuthGuard) y decoradores (@Public)
```

---

## 3. Patrón de Diseño por Módulo

### 3.1 Controladores

```typescript
@Controller('<ruta-base>')
@UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)  // (cuando aplica)
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  @Post('/create/:companyId')
  @UsePipes(new ParseArrayPipe({ items: CreateXxxDto }))  // (cuando aplica)
  async create(@Body() dto: CreateXxxDto[], @Param('companyId') companyId: string) {
    return this.xxxService.create(dto, companyId);
  }
}
```

**Reglas:**
- Los controladores NO contienen lógica de negocio — solo orquestan request/response.
- Los parámetros de ruta (`companyId`, `itemId`, etc.) se extraen con `@Param()`.
- Los DTOs se validan automáticamente con el `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).

### 3.2 Servicios

```typescript
@Injectable()
export class XxxService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateXxxDto[], companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      // validaciones + lógica de negocio
      // retorno tipado
    });
  }
}
```

**Reglas:**
- Todos los servicios inyectan `PrismaService` como única dependencia (cuando solo acceden a DB).
- Operaciones atómicas se envuelven en `prisma.$transaction()`.
- Los servicios NO tienen estado — son stateless singletons.

### 3.3 DTOs y Validación

```typescript
import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEnum(ItemType)
  type!: ItemType;

  @IsNumber()
  basePrice!: number;
}
```

**Reglas:**
- Todos los DTOs usan `class-validator` + `class-transformer`.
- El `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) rechaza campos extra automáticamente.
- Se usa `@IsOptional()` para campos opcionales en updates.

---

## 4. Sistema de Guards (Seguridad por Capas)

### 4.1 JwtAuthGuard (Global — APP_GUARD)

```
Request → JwtAuthGuard
           ├── ¿Tiene @Public()? → sí → pasa
           ├── no → valida JWT vía Passport (ES256, Supabase)
           │       ├── ¿Token inválido/expirado? → 401
           │       └── Token válido → verifica User.isSuspended
           │               ├── ¿Suspendido? → 401 "Cuenta suspendida"
           │               └── Activo → pasa (req.user = { userId, email, name })
```

**Implementación:** `src/common/guards/jwt-auth.guard.ts` — extiende `AuthGuard('jwt')` con verificación de suspensión en `canActivate`.

### 4.2 ValidateCompanyGuard (Por ruta — company-scoped)

```
Request protegido → ValidateCompanyGuard
                    ├── ¿req.user existe? → no → 403
                    ├── sí → extrae companyId de params
                    │       ├── ¿companyId existe? → no → 403
                    │       └── sí → verifica ownership (userId → Company.userId)
                    │               ├── ¿No es dueño? → 401
                    │               └── Es dueño → verifica Company.isSuspended
                    │                       ├── ¿Suspendida? → 401 "Compañía suspendida"
                    │                       └── Activa → pasa
```

**Implementación:** `src/company/guards/validate-company/validate-company.guard.ts` — implementa `CanActivate`.

### 4.3 ThrottlerGuard (Global — APP_GUARD)

Configuración:
- Global: 120 requests / 60 segundos
- Auth register: 5 / 60s (`@Throttle(5, 60)`)
- Auth login: 10 / 60s (`@Throttle(10, 60)`)
- Finance chat: 30 / 60s (`@Throttle(30, 60)`)

---

## 5. Prisma — Integración con Supabase PostgreSQL

### 5.1 Configuración

```typescript
// src/prisma/prisma.service.ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
super({ adapter });
```

**Pooled connection** (puerto 6543) para queries de la aplicación.
**Direct connection** (puerto 5432) para migraciones via `prisma.config.ts`.

### 5.2 Convenciones del Schema

- **Enums**: se definen como `enum` de Prisma y se usan directamente en los modelos.
- **Timestamps**: todos los modelos tienen `createdAt @default(now())`.
- **Soft delete**: todos los modelos tienen `isRemoved @default(false)`. Las queries deben filtrar `isRemoved: false` explícitamente.
- **UUIDs**: todos los IDs son `String @id @default(uuid()) @db.Uuid`.
- **Snake case en DB**: se usa `@map("snake_case")` para columnas y `@@map("snake_case_tables")` para tablas.
- **Decimales**: `Decimal(10, 2)` para montos financieros.
- **Nulabilidad**: claves foráneas opcionales (ej: `companyId?` en Category para defaults globales) se marcan con `?`.

### 5.3 Operaciones Atómicas

Todas las operaciones que afectan múltiples tablas (ej: crear transacción + decrementar stock) se ejecutan dentro de `prisma.$transaction(async (tx) => { ... })`.

---

## 6. Flujo de Autenticación (Supabase JWT)

```
1. POST /auth/register
   Body: { name, email, password, repeat_password }
   → Valida password match
   → Verifica email único
   → Crea usuario en Supabase Auth (supabase.auth.signUp)
   → Crea registro en tabla "users" (role: USER)
   → Responde { message, user } o { message: "CONFIRM_EMAIL_REQUIRED" }

2. POST /auth/login
   Body: { email, password }
   → Autentica contra Supabase (supabase.auth.signInWithPassword)
   → Devuelve { access_token, user }

3. Request protegido
   Header: Authorization: Bearer <token>
   → JwtAuthGuard + PassportStrategy:
      a. Extrae token del header
      b. Convierte JWK (EC P-256) a PEM
      c. Verifica firma ES256, issuer, audience
      d. Payload → { userId: sub, email, name }
      e. Guard verifica User.isSuspended
      f. Request.user = { userId, email, name }
```

### JWT Strategy (pública para NestJS)

**Algoritmo**: ES256 (ECDSA P-256)
**Clave**: Coordenadas X/Y del JWK del proyecto Supabase (env vars `SUPABASE_JWT_JWK_X`, `SUPABASE_JWT_JWK_Y`)
**Issuer**: `{SUPABASE_URL}/auth/v1`
**Audience**: `authenticated`

---

## 7. Lógica Multi-Moneda

Cada `Transaction` almacena **ambos montos**:

```typescript
function calculateAmounts(amount: number, currency: Currency, dollarRate: number) {
  if (currency === Currency.DOLARES) {
    return { amountUSD: amount, amountBs: amount * dollarRate };
  }
  // currency === BOLIVARES
  return { amountUSD: amount / dollarRate, amountBs: amount };
}
```

**Regla:** `amountUSD` y `amountBs` se almacenan SIEMPRE. `dollarRate` es la tasa BCV del día de la transacción.

---

## 8. Control de Stock

- **Items tipo PRODUCT**: tienen `stockCurrent`.
- **Transacciones INFLOW** (ventas) con Item PRODUCT → decrementan `stockCurrent`.
- **Lotes de producción** con categorías INFLOW → decrementan `stockCurrent`.
- **Items tipo SERVICE**: no tienen stock, nunca se decrementan.
- **Validación**: stock suficiente se verifica dentro del `$transaction` ANTES de escribir.

---

## 9. Búsqueda Difusa (Fuzzy Search)

Dos niveles en cascada:

1. **Primario**: función PostgreSQL `search_item_fuzzy(search_name, p_company_id)` y `search_category_fuzzy(search_name, p_company_id)` usando extensión `pg_trgm` + `similarity()`.
2. **Fallback**: Prisma `where: { name: { contains: termino, mode: 'insensitive' } }` con `take: 20`.

Ambas estrategias devuelven resultados ordenados por relevancia descendente.

---

## 10. MCP (Model Context Protocol) — Arquitectura

### 10.1 Transporte

HTTP SSE (Server-Sent Events) — deshabilitado por defecto (`MCP_HTTP_ENABLED=false`).

```
GET /mcp/sse/:companyId  → establece conexión SSE, registra sesión con AsyncLocalStorage
POST /mcp/messages       → recibe mensajes MCP, los enruta a la sesión SSE correspondiente
```

### 10.2 Aislamiento por Tenant

```typescript
// mcp-tenant.context.ts
export const mcpTenantContext = new AsyncLocalStorage<{ companyId: string; userId: string }>();
```

Cada conexión SSE guarda `{ companyId, userId }` en el contexto. Todas las herramientas MCP resuelven `companyId` desde este contexto, asegurando que un usuario no acceda a datos ajenos.

### 10.3 Herramientas Registradas (20 actuales)

**Business Intelligence (5):**
- `get_global_margin` — Margen de contribución global
- `get_product_margin` — Margen por producto
- `get_service_margin` — Margen por servicio
- `get_product_margin_by_batch` — Margen por lote
- `get_break_even_point` — Punto de equilibrio

**Search (2):**
- `search_item_by_name` — Búsqueda fuzzy de items
- `search_category_by_name` — Búsqueda fuzzy de categorías

**List/Read (13):**
- `list_categories`, `list_items`, `list_products`, `list_services`
- `list_transactions`, `get_transaction_by_id`
- `get_transactions_by_date_range`, `get_transactions_by_category`
- `list_production_batches`, `get_batches_by_product`, `get_batch_by_id`
- `get_total_cash_flow`, `get_cash_flow_by_date_range`

### 10.4 Registro de Herramientas

Cada herramienta se registra con:
- **Zod schema** — para validación de entrada
- **Groq JSON Schema** — convertido desde Zod via `zodShapeToGroqParameters()`
- **Handler** — función que llama al service correspondiente y devuelve resultado serializado

---

## 11. IA y Chat Financiero — Arquitectura

### 11.1 Pipeline de Procesamiento

```
POST /finance-chat/ask/:companyId
  Body: { preguntaUsuario: string }

  1. detectarConsultaEncadenada(pregunta)
     → Regex para consultas compuestas (margen + producto + fecha)
     → Resuelve nombres de entidades a IDs via search tools
     → Ejecuta herramienta objetivo concreta
     → Retorna resultado estructurado

  2. planificarEjecucionDirecta(pregunta)
     → Regex para consultas simples
     → "listar productos" → list_products()
     → "stock actual" → get_all_items() + filtrar
     → Retorna resultado

  3. inferirHerramientaPorPalabrasClave(pregunta)
     → Mapa de palabras clave → herramientas
     → "margen, contribucion" → get_global_margin
     → Retorna resultado

  4. Groq LLM Fallback
     → Envía pregunta + tool definitions a groq-sdk
     → Ejecuta tool calls que el modelo decida
     → Formatea resultado
```

### 11.2 Modelo

- **Provider**: Groq
- **Modelo**: `llama-3.3-70b-versatile`
- **API Key**: `GROQ_API_KEY` (sin ella, chat deshabilitado)

---

## 12. Seguridad

| Capa | Implementación | Ubicación |
|------|---------------|-----------|
| HTTP Headers | `helmet()` | `main.ts` |
| CORS | `FRONTEND_URL` env (multi-origen) | `main.ts` |
| Rate Limiting | `@nestjs/throttler` (120/60s global + específicos) | `app.module.ts` |
| Validación | `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) | `main.ts` |
| Autenticación | JWT ES256 via Passport + Supabase | `jwt.strategy.ts` |
| Autorización (tenant) | ValidateCompanyGuard (ownership + isSuspended) | `company/guards/` |
| Suspensión | JwtAuthGuard (User.isSuspended) + ValidateCompanyGuard (Company.isSuspended) | `common/guards/ + company/guards/` |
| Soft Deletes | Campo `isRemoved` en todos los modelos | `prisma/schema.prisma` |
| Aislamiento MCP | `AsyncLocalStorage` por sesión SSE | `mcp/mcp-tenant.context.ts` |

---

## 13. Variables de Entorno

| Variable | Tipo | Requerida | Uso |
|----------|------|-----------|-----|
| `DATABASE_URL` | string | ✅ | Pooled connection a Supabase PostgreSQL |
| `DIRECT_URL` | string | ✅ | Conexión directa para migraciones |
| `SUPABASE_URL` | string | ✅ | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | string | ✅ | Anon key de Supabase |
| `SUPABASE_JWT_JWK_X` | string | ✅ | Coordenada X de clave EC P-256 |
| `SUPABASE_JWT_JWK_Y` | string | ✅ | Coordenada Y de clave EC P-256 |
| `SUPABASE_JWT_ISSUER` | string | ❌ | Issuer del JWT |
| `SUPABASE_JWT_AUDIENCE` | string | ❌ | Audience del JWT (default: authenticated) |
| `FRONTEND_URL` | string | ❌ | Orígenes CORS permitidos (coma separados) |
| `GROQ_API_KEY` | string | ❌ | API Key de Groq |
| `MCP_HTTP_ENABLED` | boolean | ❌ | Habilitar MCP HTTP SSE (default: false) |
| `PORT` | number | ❌ | Puerto del servidor (default: 3000) |
| `ADMIN_SECRET_KEY` | string | ❌ | Clave para registro de admin |
| `STRIPE_SECRET_KEY` | string | ❌ | API Key de Stripe |
| `STRIPE_WEBHOOK_SECRET` | string | ❌ | Firma de webhook de Stripe |
| `PAYPAL_CLIENT_ID` | string | ❌ | Client ID de PayPal |
| `PAYPAL_CLIENT_SECRET` | string | ❌ | Client Secret de PayPal |
| `PAYPAL_WEBHOOK_ID` | string | ❌ | ID del webhook de PayPal |
| `CLOUDINARY_CLOUD_NAME` | string | ❌ | Cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | string | ❌ | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | string | ❌ | API Secret de Cloudinary |
| `GEMINI_API_KEY` | string | ❌ | API Key de Gemini Vision (OCR) |

---

## 14. Testing

- **Runner**: Jest
- **Config**: `tsconfig.json` (paths alias `@/` → `src/`)
- **Unit tests**: `*.spec.ts` junto al archivo fuente
- **E2E**: `test/app.e2e-spec.ts` con `test/jest-e2e.json`
- **Coverage**: `npm run test:cov`

---

## 15. Mapa de Dependencias entre Módulos

```
AppModule
├── AuthModule          (dependencias: PrismaModule)
├── CompanyModule       (dependencias: PrismaModule)
├── CategoryModule      (dependencias: PrismaModule, CompanyModule)
├── ItemModule          (dependencias: PrismaModule, CompanyModule)
├── TransactionModule   (dependencias: PrismaModule, CompanyModule)
├── ProductionBatchModule (dependencias: PrismaModule, CompanyModule, TransactionModule)
├── CashFlowModule      (dependencias: PrismaModule, CompanyModule)
├── ContributionMarginModule (dependencias: PrismaModule, CompanyModule)
├── BalancePointModule  (dependencias: PrismaModule, ContributionMarginModule, CompanyModule)
├── McpModule           (dependencias: CompanyModule, ContributionMarginModule, ...)
├── GroqAgentModule     (dependencias: McpModule)
├── FinanceChatModule   (dependencias: McpModule, GroqAgentModule, CompanyModule)
├── PrismaModule        (singleton global)
└── ThrottlerModule     (global)
```

**Futuros módulos a agregar:**
```
├── AdminModule         (dependencias: PrismaModule, CompanyModule)
├── NotificationsModule (dependencias: PrismaModule, ScheduleModule)
├── PaymentsModule      (dependencias: PrismaModule, CompanyModule)
├── ReportsModule       (dependencias: ReportService → integrates with MCP)
├── InvoiceScanModule   (dependencias: PrismaModule, GroqAgentModule or Gemini)
├── GrossProfitModule   (dependencias: PrismaModule, CompanyModule)
├── NetProfitModule     (dependencias: PrismaModule, CompanyModule)
├── UnitCostModule      (dependencias: PrismaModule, CompanyModule)
└── PriceMarginModule   (dependencias: UnitCostModule)
```
