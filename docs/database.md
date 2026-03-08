# Database Schema

PostgreSQL 16. All tables use `SERIAL` primary keys and `snake_case` naming.

## Tables

### users

Stores user accounts and credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `email` | VARCHAR(254) | NOT NULL, UNIQUE | Login email address |
| `password_hash` | VARCHAR(255) | NOT NULL | Argon2id hash |
| `firstname` | VARCHAR(100) | NOT NULL, DEFAULT '' | First name |
| `lastname` | VARCHAR(100) | NOT NULL, DEFAULT '' | Last name |
| `admin` | BOOLEAN | NOT NULL, DEFAULT FALSE | Admin flag |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Registration date |

### sessions

Stores active authentication sessions. Linked to `users`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `user_id` | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | Owning user |
| `token` | VARCHAR(128) | NOT NULL, UNIQUE | Session token (stored in cookie) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Session creation time |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration (48h after creation) |

### products

Product catalog. Supports featured homepage display and multiple images/colors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `name` | VARCHAR(255) | NOT NULL | Product name |
| `price` | INTEGER | NOT NULL, DEFAULT 0 | Price in cents |
| `picture` | VARCHAR(255) | DEFAULT '' | Main image filename |
| `category` | VARCHAR(255) | DEFAULT '' | Product category |
| `details` | TEXT | DEFAULT '' | Product description |
| `active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Published flag |
| `secondary_pictures` | TEXT | DEFAULT '' | Comma-separated image filenames |
| `colors` | TEXT | DEFAULT '' | Comma-separated color codes |
| `onfront_order` | INTEGER | DEFAULT NULL | Homepage display sort order (NULL = not featured) |

### account_addresses

User shipping/billing addresses. Multiple addresses per user with one default.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `user_id` | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | Owning user |
| `firstname` | VARCHAR(100) | NOT NULL, DEFAULT '' | Recipient first name |
| `lastname` | VARCHAR(100) | NOT NULL, DEFAULT '' | Recipient last name |
| `phonenumber` | VARCHAR(50) | DEFAULT '' | Contact phone |
| `address` | VARCHAR(255) | NOT NULL, DEFAULT '' | Street address |
| `city` | VARCHAR(100) | NOT NULL, DEFAULT '' | City |
| `postal_code` | VARCHAR(20) | NOT NULL, DEFAULT '' | Postal/ZIP code |
| `country` | VARCHAR(10) | NOT NULL, DEFAULT '' | Country code |
| `address_type` | INTEGER | NOT NULL, DEFAULT 1 | 1 = shipping, 2 = billing |
| `default_address` | BOOLEAN | NOT NULL, DEFAULT FALSE | Default address flag |

### orders

Completed orders. Linked to `users` for ownership tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `user_id` | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | Ordering user |
| `amount` | NUMERIC(10,2) | DEFAULT NULL | Legacy total (decimal) |
| `total_cents` | INTEGER | DEFAULT NULL | Total in cents |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | Order status: pending, paid, shipped, etc. |
| `transaction_key` | VARCHAR(255) | DEFAULT NULL | Payment gateway transaction ID |
| `shipping_address` | TEXT | DEFAULT NULL | JSON-encoded shipping address snapshot |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Order creation time |

### order_items

Line items for each order. Links orders to products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `order_id` | INTEGER | NOT NULL, FK → orders(id) ON DELETE CASCADE | Parent order |
| `product_id` | INTEGER | FK → products(id) ON DELETE SET NULL | Referenced product |
| `product_key` | VARCHAR(50) | DEFAULT NULL | Encoded product key (ID + size + color) |
| `quantity` | INTEGER | NOT NULL, DEFAULT 1 | Quantity ordered |
| `unit_price_cents` | INTEGER | NOT NULL, DEFAULT 0 | Unit price at time of purchase |

### cart_items

Active shopping cart items. Session-based carts use PHP sessions; this table is for persistent carts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `user_id` | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | Owning user |
| `product_id` | INTEGER | NOT NULL, FK → products(id) ON DELETE CASCADE | Product in cart |
| `quantity` | INTEGER | NOT NULL, DEFAULT 1 | Quantity |

## Indexes

All indexes are defined in `migrations/001_add_indexes.sql`.

| Index | Table | Column(s) | Type | Purpose |
|-------|-------|-----------|------|---------|
| `idx_sessions_token` | sessions | token | B-tree | Auth middleware token lookup |
| `idx_sessions_user_id` | sessions | user_id | B-tree | Session cleanup by user |
| `idx_addresses_user_id` | account_addresses | user_id | B-tree | Address list by user |
| `idx_orders_user_id` | orders | user_id | B-tree | Order list by user |
| `idx_orders_status` | orders | status | B-tree | Order filtering by status |
| `idx_order_items_order_id` | order_items | order_id | B-tree | Item lookup by order |
| `idx_products_active` | products | active | B-tree | Active product filtering |
| `idx_cart_items_user_id` | cart_items | user_id | B-tree | Cart lookup by user |
| `idx_products_onfront` | products | onfront_order | Partial B-tree | Featured products (WHERE active AND onfront_order > 0) |

## Entity Relationships

```
users ──┬── sessions          (1:N)
        ├── account_addresses (1:N)
        ├── orders            (1:N)
        └── cart_items        (1:N)

orders ──── order_items       (1:N)

products ──┬── order_items    (1:N, SET NULL on delete)
           └── cart_items     (1:N, CASCADE on delete)
```

## Migrations

Migration files live in the `migrations/` directory and follow the naming convention `NNN_description.sql`.

| File | Description |
|------|-------------|
| `001_add_indexes.sql` | Adds all B-tree and partial indexes on FK and hot query columns |

Apply migrations manually:

```bash
psql -d blessp -f migrations/001_add_indexes.sql
```

## Product Key Encoding

Cart items and order items use a product key that encodes the product ID, size, and color into a single string:

```
Format: {productId:05d}{size:03s}{color:03s}
Example: 00001XXL001  →  Product 1, size XXL, color 001
```

This allows the cart to distinguish the same product in different size/color combinations.
