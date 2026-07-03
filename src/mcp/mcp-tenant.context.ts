import { AsyncLocalStorage } from 'node:async_hooks';

export type McpTenantStore = {
  companyId: string;
  userId: string;
};

export const mcpTenantContext = new AsyncLocalStorage<McpTenantStore>();

export function resolveMcpCompanyId(
  clientCompanyId: unknown,
): string | undefined {
  const store = mcpTenantContext.getStore();
  if (store?.companyId) {
    return store.companyId;
  }
  return typeof clientCompanyId === 'string' ? clientCompanyId : undefined;
}
