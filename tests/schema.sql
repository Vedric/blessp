-- Test database schema for blessp
-- Reconstructed from SQL queries across all PHP modules

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS account_addresses CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    firstname VARCHAR(100) NOT NULL DEFAULT '',
    lastname VARCHAR(100) NOT NULL DEFAULT '',
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    picture VARCHAR(255) DEFAULT '',
    category VARCHAR(255) DEFAULT '',
    details TEXT DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    secondary_pictures TEXT DEFAULT '',
    colors TEXT DEFAULT '',
    onfront_order INTEGER DEFAULT NULL
);

CREATE TABLE account_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    firstname VARCHAR(100) NOT NULL DEFAULT '',
    lastname VARCHAR(100) NOT NULL DEFAULT '',
    phonenumber VARCHAR(50) DEFAULT '',
    address VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    postal_code VARCHAR(20) NOT NULL DEFAULT '',
    country VARCHAR(10) NOT NULL DEFAULT '',
    address_type INTEGER NOT NULL DEFAULT 1,
    default_address BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) DEFAULT NULL,
    total_cents INTEGER DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    transaction_key VARCHAR(255) DEFAULT NULL,
    shipping_address TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_key VARCHAR(50) DEFAULT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1
);

-- ── Indexes ───────────────────────────────────────────────────────
-- Sessions: token lookup with expiry check (auth on every request)
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Addresses: list by user, ordered by default flag
CREATE INDEX idx_addresses_user_id ON account_addresses(user_id);

-- Orders: list by user, filter by status
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order items: lookup by order
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Products: filter by active, featured sort
CREATE INDEX idx_products_active ON products(active);

-- Cart items: lookup by user
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- Products: featured homepage display sort
CREATE INDEX idx_products_onfront ON products(onfront_order) WHERE active IS TRUE AND onfront_order IS NOT NULL AND onfront_order > 0;
