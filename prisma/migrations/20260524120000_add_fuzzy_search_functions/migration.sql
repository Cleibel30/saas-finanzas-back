-- Funciones de búsqueda difusa para items y categorías (usadas por MCP y REST)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- PostgreSQL no permite cambiar el OUT/RETURNS TABLE con CREATE OR REPLACE
DROP FUNCTION IF EXISTS search_item_fuzzy(text, uuid);
DROP FUNCTION IF EXISTS search_category_fuzzy(text, uuid);

CREATE FUNCTION search_item_fuzzy(search_name text, p_company_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    type "ItemType",
    base_price numeric,
    stock_current integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        i.id,
        i.name,
        i.type,
        i.base_price,
        i.stock_current
    FROM items i
    WHERE i.company_id = p_company_id
      AND i.is_removed = false
      AND (
          i.name ILIKE '%' || search_name || '%'
          OR similarity(i.name, search_name) > 0.15
      )
    ORDER BY similarity(i.name, search_name) DESC, i.name ASC
    LIMIT 20;
$$;

CREATE FUNCTION search_category_fuzzy(search_name text, p_company_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    type "CategoryType",
    flow_direction "FlowDirection",
    is_cogs boolean,
    is_default boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.id,
        c.name,
        c.type,
        c.flow_direction,
        c.is_cogs,
        c.is_default
    FROM categories c
    WHERE c.is_removed = false
      AND (c.company_id = p_company_id OR c.is_default = true)
      AND (
          c.name ILIKE '%' || search_name || '%'
          OR similarity(c.name, search_name) > 0.15
      )
    ORDER BY similarity(c.name, search_name) DESC, c.name ASC
    LIMIT 20;
$$;
