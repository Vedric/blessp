# 001. 🐘 Use PostgreSQL as the Primary Database

**Status**: ✅ Accepted
**Date**: 2026-03-13
**Deciders**: Engineering team

## 🤔 Context

The BLE$$ P platform requires a relational database to store user accounts, product catalogs, orders, cart state, and payment records. The data model is inherently relational, with well-defined foreign key relationships between users, orders, order items, and products.

Beyond basic relational features, we have specific technical requirements:

| Requirement | Why |
|-------------|-----|
| **JSONB columns** | Store flexible shipping address snapshots on orders without creating a rigid schema for address formats that vary by country |
| **Array columns** | Store product images, colors, and sizes as `VARCHAR[]` arrays, avoiding the overhead of join tables for simple string lists |
| **Strong transactions** | Order creation reads the cart, creates the order, inserts order items, and clears the cart in a single atomic operation. Partial completion would leave the system in an inconsistent state |
| **UUID primary keys** | Native `uuid` type with `uuid_generate_v4()` for globally unique, non-sequential identifiers |
| **Soft deletes** | Nullable `TIMESTAMPTZ` columns (`deleted_at`) for users and products, with queries that filter them out by default |

### 🔍 Alternatives Evaluated

| Database | Verdict | Reasoning |
|----------|---------|-----------|
| **PostgreSQL 16** | ✅ Selected | Meets every requirement. Mature, battle-tested, excellent Prisma support |
| **MySQL 8** | ❌ Rejected | No native array type. Weaker JSONB querying compared to PostgreSQL's `@>`, `?`, and `jsonb_path_query`. Prisma support exists but PostgreSQL-specific features (arrays, enums) would require workarounds |
| **SQLite** | ❌ Rejected | Single-writer concurrency model. Unsuitable for a multi-user e-commerce platform where concurrent writes to orders, carts, and inventory are expected |
| **MongoDB** | ❌ Rejected | The data model is strongly relational. Embedding orders inside user documents would lead to unbounded document growth. Foreign key enforcement is unavailable at the database level |

## ✅ Decision

We adopt **PostgreSQL 16** as the primary database for all environments (development, test, and production).

### Key Factors

1. 🔒 **Relational integrity:** PostgreSQL enforces foreign keys, unique constraints, and check constraints at the database level, providing a safety net beyond application-layer validation.

2. 🧩 **Rich type system:** Native support for UUID primary keys, JSONB columns, and array types reduces the need for workaround patterns (join tables for tags, separate JSON document stores).

3. 🔧 **Prisma ORM compatibility:** Prisma 6.5 has first-class support for PostgreSQL, including migration generation, introspection, type-safe query building, and native array/JSONB handling.

4. ⚡ **Transactional safety:** ACID-compliant transactions are essential for the order creation flow, which involves multiple table writes that must succeed or fail atomically.

5. 🌍 **Ecosystem maturity:** PostgreSQL has extensive documentation, a large community, and broad support across managed database providers.

### Managed Provider Compatibility

| Provider | Service |
|----------|---------|
| AWS | RDS for PostgreSQL, Aurora PostgreSQL |
| Google Cloud | Cloud SQL for PostgreSQL, AlloyDB |
| Azure | Azure Database for PostgreSQL |
| Supabase | Built on PostgreSQL |
| Neon | Serverless PostgreSQL with branching |
| Railway | One-click PostgreSQL deployment |

## 📊 Consequences

### What becomes easier ✅

- **Storing structured data** like shipping addresses as JSONB without a separate table or rigid schema
- **Using array columns** for product attributes (images, colors, sizes) instead of many-to-many join tables
- **Leveraging PostgreSQL-specific features** such as partial indexes, `UPSERT` (`ON CONFLICT`), CTEs, and `pg_trgm` for future search functionality
- **Running the same database engine** in all environments (dev, test, staging, production) for consistent behavior
- **Scaling horizontally** when needed, using read replicas or connection pooling (PgBouncer)
- **Using Docker Compose** with the official `postgres:16-alpine` image for zero-configuration local development

### What becomes harder ⚠️

- **Local setup without Docker:** Developers must have PostgreSQL 16+ installed locally or use the Docker Compose setup. We mitigate this by providing `docker-compose.dev.yml` for one-command startup
- **Vendor coupling:** The application uses PostgreSQL-specific features (arrays, JSONB operators), making a future migration to a different RDBMS more costly. We accept this trade-off because the benefits outweigh the migration risk
- **Operational cost:** Managed PostgreSQL instances carry higher costs than simpler alternatives like SQLite for very small deployments. This is appropriate for an e-commerce platform where data integrity justifies the cost

### PostgreSQL Features Used in the Schema

| Feature | Where Used |
|---------|-----------|
| `UUID` type | Primary keys on all 9 tables |
| `VARCHAR[]` arrays | `products.images`, `products.colors`, `products.sizes` |
| `JSONB` | `orders.shipping_address` |
| `TIMESTAMPTZ` | All timestamp columns (timezone-aware) |
| Unique constraints | `users.email`, `sessions.token`, `refresh_tokens.token`, `orders.transaction_key` |
| Composite unique | `cart_items(user_id, product_id, size, color)` |
| Cascade deletes | All child tables referencing `users` |
| Set null on delete | `order_items.product_id` referencing `products` |
| B-tree indexes | 18 indexes across all tables for query performance |
