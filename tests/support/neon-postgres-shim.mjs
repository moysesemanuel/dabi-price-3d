import postgres from "postgres";

let sqlClient = null;

function renderQuery(query) {
  return query.strings.reduce(
    (statement, segment, index) =>
      `${statement}${segment}${
        index < query.args.length ? `$${index + 1}` : ""
      }`,
    "",
  );
}

export function neon(databaseUrl) {
  if (databaseUrl !== process.env.TEST_DATABASE_URL) {
    throw new Error("The integration runner only permits TEST_DATABASE_URL.");
  }

  if (sqlClient) {
    return sqlClient;
  }

  const sql = postgres(databaseUrl, {
    idle_timeout: 1,
    max: 10,
    onnotice: () => {},
  });

  sql.transaction = (queries) =>
    sql.begin(async (transactionSql) => {
      const results = [];

      for (const query of queries) {
        results.push(
          await transactionSql.unsafe(renderQuery(query), query.args),
        );
      }

      return results;
    });

  sqlClient = sql;
  return sqlClient;
}

export async function closeNeonPostgresShim() {
  await sqlClient?.end({ timeout: 1 });
  sqlClient = null;
}
