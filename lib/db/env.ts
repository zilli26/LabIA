export function hasDatabaseEnv() {
  return Boolean(process.env.DATABASE_URL && process.env.DIRECT_URL);
}
