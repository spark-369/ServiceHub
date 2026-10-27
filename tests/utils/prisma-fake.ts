/**
 * Deterministic in-memory Prisma fake used by `jest.setup.js`.
 *
 * Backed by plain arrays so route handlers run their REAL filtering,
 * pagination, aggregation and auth logic against realistic data instead of
 * asserting against hand-rolled `jest.fn()` call shapes. Supports the subset of
 * the Prisma client API that the app's routes actually use:
 *
 *   findUnique / findFirst / findMany / create / update / delete /
 *   deleteMany / count / aggregate / groupBy / $queryRaw / $transaction
 */

type Row = Record<string, any>;
type WhereClause = Record<string, any>;

interface QueryOptions {
  where?: WhereClause;
  orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  skip?: number;
  take?: number;
  include?: Record<string, any>;
  select?: Record<string, any>;
  distinct?: string[];
  _avg?: Record<string, boolean>;
  _sum?: Record<string, boolean>;
  _count?: boolean | Record<string, boolean>;
}

const MODELS = ["user", "service", "booking", "review", "payment", "webhookEvent"] as const;
type ModelName = (typeof MODELS)[number];

/**
 * Scalar column defaults mirroring `prisma/schema.prisma`, applied on `create`
 * when the caller omits the field — exactly like a real Prisma insert. Without
 * these, a route that relies on a schema default (e.g. `Service.isActive`) would
 * store `undefined` and fail default-value filters like `{ isActive: true }`.
 */
const MODEL_DEFAULTS: Partial<Record<ModelName, Row>> = {
  user: { role: "customer", isVerified: false },
  service: { rating: 0, reviewCount: 0, isActive: true },
  booking: { status: "pending", paymentStatus: "pending" },
  webhookEvent: { provider: "stripe" },
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function resetIds() {
  idCounter = 0;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function matchScalar(value: any, condition: any): boolean {
  if (condition === null) return value === null || value === undefined;
  if (condition !== null && typeof condition === "object" && !Array.isArray(condition)) {
    if ("in" in condition) return (condition.in as any[]).includes(value);
    if ("not" in condition) return !matchScalar(value, condition.not);
    if ("contains" in condition) {
      if (value === null || value === undefined) return false;
      const insensitive = condition.mode === "insensitive";
      const hay = insensitive ? String(value).toLowerCase() : String(value);
      const needle = insensitive
        ? String(condition.contains).toLowerCase()
        : String(condition.contains);
      return hay.includes(needle);
    }
    if ("gte" in condition || "lte" in condition || "gt" in condition || "lt" in condition) {
      const v = value as any;
      if (typeof v !== "number" && !(v instanceof Date)) return false;
      if ("gte" in condition && !(v >= condition.gte)) return false;
      if ("lte" in condition && !(v <= condition.lte)) return false;
      if ("gt" in condition && !(v > condition.gt)) return false;
      if ("lt" in condition && !(v < condition.lt)) return false;
      return true;
    }
    return deepEqual(value, condition);
  }
  return value === condition;
}


function matchWhere(row: Row, where: WhereClause | undefined): boolean {
  if (!where) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;

    if (key === "AND") {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (!clauses.every((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (!clauses.some((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "NOT") {
      const clauses = Array.isArray(condition) ? condition : [condition];
      if (clauses.some((c) => matchWhere(row, c))) return false;
      continue;
    }

    const value = (row as any)[key];

    // Relation filter: `{ service: { name: { contains } } }` — resolve the
    // related row and recurse. Only to-one relations are used in where
    // clauses by the routes.
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      condition !== null &&
      typeof condition === "object" &&
      !("in" in condition) &&
      !("contains" in condition) &&
      !("not" in condition) &&
      !("gte" in condition) &&
      !("lte" in condition) &&
      !("gt" in condition) &&
      !("lt" in condition)
    ) {
      if (!matchWhere(value, condition as WhereClause)) return false;
      continue;
    }

    // Array field with `{ has: x }` (e.g. service.tags).
    if (
      condition !== null &&
      typeof condition === "object" &&
      !Array.isArray(condition) &&
      "has" in condition
    ) {
      if (!Array.isArray(value) || !value.includes((condition as any).has)) return false;
      continue;
    }

    if (!matchScalar(value, condition)) return false;
  }

  return true;
}

function compareValues(a: any, b: any): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function applyOrderBy(rows: Row[], orderBy: QueryOptions["orderBy"]): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  const sorted = [...rows];
  for (const spec of specs) {
    for (const [field, direction] of Object.entries(spec)) {
      sorted.sort((x, y) => {
        const cmp = compareValues((x as any)[field], (y as any)[field]);
        return direction === "desc" ? -cmp : cmp;
      });
    }
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Relation resolution (mirrors prisma/schema.prisma)
// ---------------------------------------------------------------------------

interface RelationDef {
  /** Foreign key field on the owning row (many-to-one / one-to-one). */
  foreignKey?: string;
  /** Foreign key field on the related row (one-to-many). */
  reverseKey?: string;
  /** Field on the related row holding the id. */
  targetKey: string;
  model: ModelName;
  many: boolean;
}

const RELATIONS: Record<ModelName, Record<string, RelationDef>> = {
  user: {
    bookingsAsProvider: { model: "booking", many: true, reverseKey: "providerId", targetKey: "id" },
    bookingsAsUser: { model: "booking", many: true, reverseKey: "userId", targetKey: "id" },
    reviewsAsProvider: { model: "review", many: true, reverseKey: "providerId", targetKey: "id" },
    reviewsAsUser: { model: "review", many: true, reverseKey: "userId", targetKey: "id" },
    providedServices: { model: "service", many: true, reverseKey: "providerId", targetKey: "id" },
  },
  service: {
    bookings: { model: "booking", many: true, reverseKey: "serviceId", targetKey: "id" },
    reviews: { model: "review", many: true, reverseKey: "serviceId", targetKey: "id" },
    provider: { model: "user", many: false, foreignKey: "providerId", targetKey: "id" },
  },
  booking: {
    service: { model: "service", many: false, foreignKey: "serviceId", targetKey: "id" },
    user: { model: "user", many: false, foreignKey: "userId", targetKey: "id" },
    provider: { model: "user", many: false, foreignKey: "providerId", targetKey: "id" },
    review: { model: "review", many: false, foreignKey: "id", targetKey: "bookingId" },
  },
  review: {
    booking: { model: "booking", many: false, foreignKey: "bookingId", targetKey: "id" },
    provider: { model: "user", many: false, foreignKey: "providerId", targetKey: "id" },
    user: { model: "user", many: false, foreignKey: "userId", targetKey: "id" },
  },
  payment: {},
  webhookEvent: {},
};


// ---------------------------------------------------------------------------
// Projection helpers (include / select)
// ---------------------------------------------------------------------------

function resolveRelated(rel: RelationDef, row: Row, store: Record<ModelName, Row[]>): Row[] {
  const related = store[rel.model];
  if (rel.many) {
    return related.filter((r) => (r as any)[rel.reverseKey!] === (row as any)[rel.targetKey]);
  }
  const fk = (row as any)[rel.foreignKey!];
  if (fk === null || fk === undefined) return [];
  const found = related.find((r) => (r as any)[rel.targetKey] === fk);
  return found ? [found] : [];
}

/**
 * Normalise a nested relation spec into a flat `{ select, include }` pair.
 *
 * Prisma's relation syntax is `{ select: {...} }` / `{ include: {...} }` (or the
 * bare `true`). Treating that object as the select map directly is wrong: it
 * would iterate the literal key `select` and project `{ select: undefined }`,
 * so `include: { service: { select: { id: true } } }` silently produced rows
 * with `id: undefined` instead of the related row.
 */
function normaliseRelationSpec(relSpec: any): {
  select?: QueryOptions["select"];
  include?: QueryOptions["include"];
} {
  if (!relSpec || relSpec === true) return {};
  if ("select" in relSpec || "include" in relSpec) {
    return { select: relSpec.select, include: relSpec.include };
  }
  // A bare field map, e.g. `{ id: true, name: true }`.
  return { select: relSpec };
}

/**
 * Resolve and project a relation, honouring nested `select`/`include`.
 * Returns an array for to-many relations and a single row (or null) otherwise —
 * matching what Prisma actually returns.
 */
function projectRelation(
  related: Row[],
  relSpec: any,
  rel: RelationDef,
  store: Record<ModelName, Row[]>
): any {
  const { select, include } = normaliseRelationSpec(relSpec);
  const projected = related.map((row) => {
    const expanded = applyInclude(row, { include }, rel.model, store);
    return applySelect(expanded, { select }, rel.model, store);
  });
  return rel.many ? projected : projected[0] ?? null;
}

function applyInclude(
  row: Row,
  options: QueryOptions,
  model: ModelName,
  store: Record<ModelName, Row[]>
): Row {
  if (!options.include) return row;
  const withRelations: Row = { ...row };
  for (const [relName, relSpec] of Object.entries(options.include)) {
    const rel = RELATIONS[model][relName];
    if (!rel) continue;
    withRelations[relName] = projectRelation(
      resolveRelated(rel, row, store),
      relSpec,
      rel,
      store
    );
  }
  return withRelations;
}

function applySelect(
  row: Row,
  options: QueryOptions,
  model: ModelName,
  store: Record<ModelName, Row[]>
): Row {
  if (!options.select) return row;
  const out: Row = {};
  for (const [field, spec] of Object.entries(options.select)) {
    if (!spec) continue;
    const rel = RELATIONS[model][field];
    if (rel) {
      out[field] = projectRelation(resolveRelated(rel, row, store), spec, rel, store);
    } else {
      out[field] = (row as any)[field];
    }
  }
  return out;
}


// ---------------------------------------------------------------------------
// The fake client
// ---------------------------------------------------------------------------

export interface PrismaFake {
  user: ModelApi;
  service: ModelApi;
  booking: ModelApi;
  review: ModelApi;
  payment: ModelApi;
  webhookEvent: ModelApi;
  $queryRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  __seed: (model: ModelName, rows: Row[]) => void;
  __store: (model: ModelName) => Row[];
  __reset: () => void;
}

interface ModelApi {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
}

function createStore(): Record<ModelName, Row[]> {
  return {
    user: [],
    service: [],
    booking: [],
    review: [],
    payment: [],
    webhookEvent: [],
  };
}

function aggregateValues(rows: Row[], fields: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const field of fields) {
    const values = rows.map((r) => (r as any)[field]).filter((v) => typeof v === "number");
    out[field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return out;
}

function sumValues(rows: Row[], fields: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const field of fields) {
    const values = rows.map((r) => (r as any)[field]).filter((v) => typeof v === "number");
    out[field] = values.length ? values.reduce((a, b) => a + b, 0) : null;
  }
  return out;
}

function makeAggregate(store: Record<ModelName, Row[]>, model: ModelName): jest.Mock {
  return jest.fn(async (options: QueryOptions = {}) => {
    const rows = store[model].filter((r) => matchWhere(r, options.where));
    const result: Row = {};
    if (options._avg) result._avg = aggregateValues(rows, Object.keys(options._avg));
    if (options._sum) result._sum = sumValues(rows, Object.keys(options._sum));
    if (options._count !== undefined) {
      if (options._count === true) {
        result._count = rows.length;
      } else {
        const counts: Row = {};
        for (const field of Object.keys(options._count)) {
          counts[field] = rows.filter((r) => (r as any)[field] !== null && (r as any)[field] !== undefined).length;
        }
        result._count = counts;
      }
    }
    return result;
  });
}

function makeGroupBy(store: Record<ModelName, Row[]>, model: ModelName): jest.Mock {
  return jest.fn(async (options: QueryOptions & { by: string[] }) => {
    const rows = store[model].filter((r) => matchWhere(r, options.where));
    const groups = new Map<string, Row[]>();

    for (const row of rows) {
      const key = options.by.map((f) => String((row as any)[f])).join("\u0000");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const result: Row[] = [];
    for (const group of groups.values()) {
      const out: Row = {};
      for (const field of options.by) out[field] = (group[0] as any)[field];
      if (options._avg) out._avg = aggregateValues(group, Object.keys(options._avg));
      if (options._sum) out._sum = sumValues(group, Object.keys(options._sum));
      if (options._count !== undefined) {
        if (options._count === true) {
          out._count = group.length;
        } else {
          const counts: Row = {};
          for (const field of Object.keys(options._count)) {
            counts[field] = group.filter((r) => (r as any)[field] !== null && (r as any)[field] !== undefined).length;
          }
          out._count = counts;
        }
      }
      result.push(out);
    }

    return result;
  });
}

export function createPrismaFake(): PrismaFake {
  const store = createStore();

  function rowsFor(model: ModelName): Row[] {
    return store[model];
  }

  function makeModel(model: ModelName): ModelApi {
    const findMany = jest.fn(async (options: QueryOptions = {}) => {
      let rows = rowsFor(model).filter((r) => matchWhere(r, options.where));

      if (options.distinct && options.distinct.length > 0) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = options.distinct!.map((f) => String((r as any)[f])).join("\u0000");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      rows = applyOrderBy(rows, options.orderBy);
      if (options.skip) rows = rows.slice(options.skip);
      if (options.take !== undefined) rows = rows.slice(0, options.take);

      return rows.map((r) => {
        const expanded = applyInclude(r, options, model, store);
        return applySelect(expanded, options, model, store);
      });
    });

    const findFirst = jest.fn(async (options: QueryOptions = {}) => {
      const rows = rowsFor(model).filter((r) => matchWhere(r, options.where));
      if (rows.length === 0) return null;
      const expanded = applyInclude(rows[0], options, model, store);
      return applySelect(expanded, options, model, store);
    });

    const findUnique = jest.fn(async (options: QueryOptions & { where: WhereClause }) => {
      const rows = rowsFor(model).filter((r) => matchWhere(r, options.where));
      if (rows.length === 0) return null;
      const expanded = applyInclude(rows[0], options, model, store);
      return applySelect(expanded, options, model, store);
    });

    const create = jest.fn(async (args: { data: Row; include?: QueryOptions["include"]; select?: QueryOptions["select"] }) => {
      const now = new Date();
      // Schema defaults first, then explicit `data` overrides them.
      const data: Row = { ...(MODEL_DEFAULTS[model] ?? {}), ...args.data };
      if (data.createdAt === undefined) data.createdAt = now;
      if (data.updatedAt === undefined) data.updatedAt = now;
      if (data.id === undefined) data.id = nextId(model);

      const row: Row = { ...data };
      rowsFor(model).push(row);

      const options: QueryOptions = { include: args.include, select: args.select };
      const expanded = applyInclude(row, options, model, store);
      return applySelect(expanded, options, model, store);
    });

    const update = jest.fn(async (args: { where: WhereClause; data: Row; include?: QueryOptions["include"]; select?: QueryOptions["select"] }) => {
      const row = rowsFor(model).find((r) => matchWhere(r, args.where));
      if (!row) {
        throw Object.assign(new Error("Record not found"), { code: "P2025" });
      }
      const data = { ...args.data };
      if (data.updatedAt === undefined) data.updatedAt = new Date();
      Object.assign(row, data);

      const options: QueryOptions = { include: args.include, select: args.select };
      const expanded = applyInclude(row, options, model, store);
      return applySelect(expanded, options, model, store);
    });

    const updateMany = jest.fn(async (args: { where: WhereClause; data: Row }) => {
      const matches = rowsFor(model).filter((r) => matchWhere(r, args.where));
      const data = { ...args.data, updatedAt: new Date() };
      matches.forEach((r) => Object.assign(r, data));
      return { count: matches.length };
    });

    const delete_ = jest.fn(async (args: { where: WhereClause }) => {
      const idx = rowsFor(model).findIndex((r) => matchWhere(r, args.where));
      if (idx === -1) {
        throw Object.assign(new Error("Record not found"), { code: "P2025" });
      }
      const [removed] = rowsFor(model).splice(idx, 1);
      return removed;
    });

    const deleteMany = jest.fn(async (args: { where?: WhereClause } = {}) => {
      const list = rowsFor(model);
      const keep: Row[] = [];
      let count = 0;
      for (const r of list) {
        if (matchWhere(r, args.where)) count += 1;
        else keep.push(r);
      }
      list.length = 0;
      list.push(...keep);
      return { count };
    });

    const count = jest.fn(async (options: QueryOptions = {}) =>
      rowsFor(model).filter((r) => matchWhere(r, options.where)).length
    );

    return {
      findUnique,
      findFirst,
      findMany,
      create,
      update,
      updateMany,
      delete: delete_,
      deleteMany,
      count,
      aggregate: makeAggregate(store, model),
      groupBy: makeGroupBy(store, model),
    };
  }

  const client: PrismaFake = {
    user: makeModel("user"),
    service: makeModel("service"),
    booking: makeModel("booking"),
    review: makeModel("review"),
    payment: makeModel("payment"),
    webhookEvent: makeModel("webhookEvent"),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(client)
    ),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    __seed: (model, rows) => {
      store[model].push(...rows.map((r) => ({ ...r })));
    },
    __store: (model) => store[model],
    __reset: () => {
      for (const model of MODELS) store[model].length = 0;
      resetIds();
    },
  };

  return client;
}

export default createPrismaFake;
