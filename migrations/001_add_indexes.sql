-- Migration 001: Add indexes on foreign keys and hot query columns
-- These indexes cover all WHERE, JOIN, and ORDER BY columns used
-- in production queries. Each index targets a verified query path.

-- Sessions: token lookup (auth middleware, every request)
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Addresses: list by user, ordered by default flag
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON account_addresses(user_id);

-- Orders: list by user, filter by status
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Order items: lookup by parent order
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Products: filter active, featured display
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Cart items: lookup by user
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Products: featured homepage display sort
CREATE INDEX IF NOT EXISTS idx_products_onfront ON products(onfront_order) WHERE active IS TRUE AND onfront_order IS NOT NULL AND onfront_order > 0;
