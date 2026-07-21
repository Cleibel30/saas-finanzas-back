import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { resolveMcpCompanyId } from './mcp-tenant.context';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ContributionMarginService } from '../contribution-margin/contribution-margin.service';
import { GrossProfitService } from '@/gross-profit/gross-profit.service';
import { NetProfitService } from '@/net-profit/net-profit.service';
import { UnitCostService } from '@/unit-cost/unit-cost.service';
import { PriceMarginService } from '@/price-margin/price-margin.service';
import { BalancePointService } from '@/balance-point/balance-point.service';
import { CategoryService } from '@/category/category.service';
import { ItemService } from '@/item/item.service';
import { TransactionService } from '@/transaction/transaction.service';
import { ProductionBatchService } from '@/production_batch/production_batch.service';
import { CashFlowService } from '@/cash-flow/cash-flow.service';
import { zodShapeToGroqParameters } from './groq-schema.util';

export type HerramientaRegistrada = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  groqParameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
};

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  public mcpServer: McpServer;
  public herramientasRegistradas: HerramientaRegistrada[] = [];

  constructor(
    private readonly marginService: ContributionMarginService,
    private readonly grossProfitService: GrossProfitService,
    private readonly netProfitService: NetProfitService,
    private readonly unitCostService: UnitCostService,
    private readonly priceMarginService: PriceMarginService,
    private readonly balancePoint: BalancePointService,
    private readonly categoryService: CategoryService,
    private readonly itemService: ItemService,
    private readonly transactionService: TransactionService,
    private readonly productionBatchService: ProductionBatchService,
    private readonly cashFlowService: CashFlowService,
  ) {
    this.mcpServer = new McpServer({
      name: 'snoop-financial-mcp',
      version: '2.0.0',
    });
  }

  onModuleInit() {
    this.herramientasRegistradas = [];
    this.registerTools();
    this.logger.log(
      `${this.herramientasRegistradas.length} herramientas registradas para Groq y MCP SSE.`,
    );
  }

  private toMcpContent(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
  }

  private withTrustedCompanyId(
    args: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) {
    const companyId = resolveMcpCompanyId(args.companyId);
    if (!companyId) {
      throw new ForbiddenException('companyId no autorizado o ausente');
    }
    return handler({ ...args, companyId });
  }

  private registrarHerramienta(
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) {
    const safeHandler = (args: Record<string, unknown>) =>
      this.withTrustedCompanyId(args, handler);

    this.mcpServer.tool(
      name,
      description,
      schema,
      async (args: Record<string, unknown>) =>
        this.toMcpContent(await safeHandler(args)),
    );

    this.herramientasRegistradas.push({
      name,
      description,
      inputSchema: schema,
      groqParameters: zodShapeToGroqParameters(schema),
      execute: async (args: Record<string, unknown>) => {
        try {
          const data = await safeHandler(args);
          return JSON.stringify(data);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return JSON.stringify({
            success: false,
            dataSource: 'database',
            error: message,
          });
        }
      },
    });
  }

  private registerTools() {
    const dateRangeSchema = {
      startDate: z.string().describe('Fecha de inicio en formato YYYY-MM-DD'),
      endDate: z.string().describe('Fecha de fin en formato YYYY-MM-DD'),
    };

    const marginByItemSchema = {
      itemId: z
        .string()
        .uuid()
        .describe('ID del producto o servicio en formato UUID'),
      ...dateRangeSchema,
    };

    const searchSchema = {
      name: z
        .string()
        .describe('Nombre a buscar (producto, servicio o categoría)'),
    };

    const itemIdSchema = {
      itemId: z.string().uuid().describe('ID del producto o servicio'),
    };

    const categoryIdSchema = {
      categoryId: z.string().uuid().describe('ID de la categoría'),
    };

    const batchIdSchema = {
      batchId: z.string().uuid().describe('ID del lote de producción'),
    };

    const transactionIdSchema = {
      transactionId: z.string().uuid().describe('ID de la transacción'),
    };

    const emptySchema = {};

    this.registrarHerramienta(
      'get_global_margin',
      'Calcula ventas, costos variables y margen global de la empresa en un rango de fechas.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.marginService.getGlobalContributionMargin(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_product_margin',
      'Calcula margen de contribución de un producto en un rango de fechas. Requiere itemId (obtenerlo con search_item_by_name).',
      marginByItemSchema,
      async ({ companyId, itemId, startDate, endDate }) =>
        this.marginService.getContributionMarginByProductDates(
          itemId as string,
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_service_margin',
      'Calcula margen de contribución de un servicio en un rango de fechas. Requiere itemId (obtenerlo con search_item_by_name).',
      marginByItemSchema,
      async ({ companyId, itemId, startDate, endDate }) =>
        this.marginService.getContributionMarginByService(
          itemId as string,
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_product_margin_by_batch',
      'Calcula margen de contribución de un lote de producción específico.',
      batchIdSchema,
      async ({ companyId, batchId }) =>
        this.marginService.getContributionMarginByBatch(
          batchId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'get_break_even_point',
      'Calcula el punto de equilibrio de la empresa en un rango de fechas.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.balancePoint.getCompanyBreakEven(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'search_item_by_name',
      'OBLIGATORIO para consultas por nombre de producto/servicio, stock, precio o disponibilidad. Devuelve datos reales de la base de datos.',
      searchSchema,
      async ({ name, companyId }) =>
        this.itemService.getItemByName(name as string, companyId as string),
    );

    this.registrarHerramienta(
      'search_category_by_name',
      'OBLIGATORIO para consultas por nombre de categoría. Devuelve datos reales de la base de datos.',
      searchSchema,
      async ({ name, companyId }) =>
        this.categoryService.getCategoryByName(
          name as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'list_categories',
      'Lista todas las categorías activas de la empresa (incluye categorías por defecto del sistema).',
      emptySchema,
      async ({ companyId }) =>
        this.categoryService.getCategoriesByCompany(companyId as string, ''),
    );

    this.registrarHerramienta(
      'list_items',
      'Lista todos los productos y servicios activos de la empresa.',
      emptySchema,
      async ({ companyId }) =>
        this.itemService.getItemsByCompany(companyId as string),
    );

    this.registrarHerramienta(
      'list_products',
      'Lista solo los productos (tipo PRODUCT) activos de la empresa.',
      emptySchema,
      async ({ companyId }) =>
        this.itemService.getItemsProduct(companyId as string),
    );

    this.registrarHerramienta(
      'list_services',
      'Lista solo los servicios (tipo SERVICE) activos de la empresa.',
      emptySchema,
      async ({ companyId }) =>
        this.itemService.getItemsService(companyId as string),
    );

    this.registrarHerramienta(
      'list_transactions',
      'Lista todas las transacciones activas de la empresa con categoría, ítem y lote.',
      emptySchema,
      async ({ companyId }) =>
        this.transactionService.getTransactionsByCompany(companyId as string),
    );

    this.registrarHerramienta(
      'get_transaction_by_id',
      'Obtiene una transacción por su ID.',
      transactionIdSchema,
      async ({ companyId, transactionId }) =>
        this.transactionService.getTransactionById(
          transactionId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'get_transactions_by_date_range',
      'Lista transacciones en un rango de fechas de pago.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.transactionService.getTransactionsByDateRange(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_transactions_by_category',
      'Lista transacciones de una categoría. Requiere categoryId (obtenerlo con search_category_by_name).',
      categoryIdSchema,
      async ({ companyId, categoryId }) =>
        this.transactionService.getTransactionsByCategory(
          companyId as string,
          categoryId as string,
        ),
    );

    this.registrarHerramienta(
      'list_production_batches',
      'Lista todos los lotes de producción activos de la empresa.',
      emptySchema,
      async ({ companyId }) =>
        this.productionBatchService.getBatchesByCompany(companyId as string),
    );

    this.registrarHerramienta(
      'get_batches_by_product',
      'Lista lotes de producción de un producto. Requiere itemId.',
      itemIdSchema,
      async ({ companyId, itemId }) =>
        this.productionBatchService.getBatchByProduct(
          companyId as string,
          itemId as string,
        ),
    );

    this.registrarHerramienta(
      'get_batch_by_id',
      'Obtiene un lote de producción por ID con sus transacciones.',
      batchIdSchema,
      async ({ companyId, batchId }) =>
        this.productionBatchService.getBatchById(
          batchId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'get_total_cash_flow',
      'Resumen de flujo de caja total de la empresa (USD y Bs).',
      emptySchema,
      async ({ companyId }) =>
        this.cashFlowService.getTotalCashFlow(companyId as string),
    );

    this.registrarHerramienta(
      'get_cash_flow_by_date_range',
      'Flujo de caja detallado en un rango de fechas.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.cashFlowService.getCashFlow(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_gross_profit',
      'Calcula la utilidad bruta global (Ventas Netas - COGS) de la empresa en un rango de fechas.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.grossProfitService.getGlobalGrossProfit(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_product_gross_profit',
      'Calcula la utilidad bruta de un producto en un rango de fechas. Requiere itemId (obtenerlo con search_item_by_name).',
      marginByItemSchema,
      async ({ companyId, itemId, startDate, endDate }) =>
        this.grossProfitService.getProductGrossProfit(
          itemId as string,
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_service_gross_profit',
      'Calcula la utilidad bruta de un servicio en un rango de fechas. Requiere itemId (obtenerlo con search_item_by_name).',
      marginByItemSchema,
      async ({ companyId, itemId, startDate, endDate }) =>
        this.grossProfitService.getServiceGrossProfit(
          itemId as string,
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_net_profit',
      'Calcula la utilidad neta completa (Gross Profit - Expenses) de la empresa en un rango de fechas.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.netProfitService.getNetProfit(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_net_profit_statement',
      'Obtiene un estado de resultados P&L estructurado con Ventas, Utilidad Bruta, Gastos y Utilidad Neta.',
      dateRangeSchema,
      async ({ companyId, startDate, endDate }) =>
        this.netProfitService.getStatement(
          companyId as string,
          new Date(startDate as string),
          new Date(endDate as string),
        ),
    );

    this.registrarHerramienta(
      'get_unit_cost_by_batch',
      'Obtiene el costo total unitario de un lote de producción específico. Requiere batchId (obtenerlo con get_batch_by_id o list_production_batches).',
      batchIdSchema,
      async ({ companyId, batchId }) =>
        this.unitCostService.getBatchUnitCost(
          batchId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'get_unit_cost_by_product',
      'Obtiene el costo unitario promedio ponderado de un producto basado en sus lotes CLOSED. Requiere itemId (obtenerlo con search_item_by_name o list_products).',
      itemIdSchema,
      async ({ companyId, itemId }) =>
        this.unitCostService.getProductUnitCost(
          itemId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'get_unit_cost_by_service',
      'Obtiene el costo unitario promedio de un servicio basado en sus costos OUTFLOW dividido entre servicios vendidos. Requiere itemId (obtenerlo con search_item_by_name o list_services).',
      itemIdSchema,
      async ({ companyId, itemId }) =>
        this.unitCostService.getServiceUnitCost(
          itemId as string,
          companyId as string,
        ),
    );

    this.registrarHerramienta(
      'calculate_price_with_margin',
      'Calcula el precio de venta recomendado para un producto o servicio dado su costo unitario y un margen objetivo. Detecta automáticamente si es producto o servicio. Requiere itemId y targetMarginPercent (ej: 30 para 30%).',
      {
        itemId: z.string().uuid().describe('ID del producto o servicio'),
        targetMarginPercent: z
          .number()
          .min(0)
          .max(99)
          .describe('Margen objetivo en porcentaje (ej: 30 para 30%)'),
      },
      async ({ companyId, itemId, targetMarginPercent }) =>
        this.priceMarginService.calculateMarginTarget(
          itemId as string,
          companyId as string,
          targetMarginPercent as number,
        ),
    );
  }

  async ejecutarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
    companyId: string,
  ): Promise<string> {
    const herramienta = this.herramientasRegistradas.find(
      (t) => t.name === nombre,
    );

    if (!herramienta) {
      return JSON.stringify({
        success: false,
        dataSource: 'database',
        error: `Herramienta "${nombre}" no registrada.`,
      });
    }

    return herramienta.execute({ ...argumentos, companyId });
  }
}
