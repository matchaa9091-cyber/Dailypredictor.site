import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Retrieves the Cloudflare D1 database instance.
 * Prioritizes the Edge request context (Cloudflare Pages),
 * with a fallback to the Cloudflare D1 REST API for local node environments if tokens are supplied.
 */
export function getD1() {
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && ctx.env.DB) {
      return ctx.env.DB;
    }
  } catch {
    // getRequestContext can throw outside of Cloudflare edge request context
  }

  // Fallback for local development via Cloudflare D1 REST API
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "75a566f7db81d6c9e2b0dbbcff7f4ca0";
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || "2d89927b-c0b7-4fdb-8cf3-fbfe3cd15b21";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (apiToken && accountId && databaseId) {
    return {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async all() {
                const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ sql, params })
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.errors?.[0]?.message || 'D1 query failed');
                return { results: json.result?.[0]?.results || [] };
              },
              async first(col) {
                const res = await this.all();
                const row = res.results?.[0] || null;
                if (!row) return null;
                return col ? row[col] : row;
              },
              async run() {
                const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ sql, params })
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.errors?.[0]?.message || 'D1 query failed');
                const meta = json.result?.[0]?.meta || {};
                return { success: true, meta: { last_row_id: meta.last_row_id, changes: meta.changes } };
              }
            };
          },
          async all() {
            return this.bind().all();
          },
          async first(col) {
            return this.bind().first(col);
          },
          async run() {
            return this.bind().run();
          }
        };
      }
    };
  }

  throw new Error("Cloudflare D1 is not available. Please ensure env.DB is bound in wrangler.toml or CLOUDFLARE_API_TOKEN is provided.");
}
