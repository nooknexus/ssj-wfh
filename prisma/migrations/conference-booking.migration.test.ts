import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const enabled = process.env.RUN_DB_MIGRATION_TEST === "1";
const migrationPath = join(process.cwd(), "prisma/migrations/20261020_conference_booking/migration.sql");
const containerName = `conference-migration-${process.pid}`;
const databaseName = "conference_migration_test";

const docker = (args: string[], input?: string) =>
  execFileSync("docker", args, { encoding: "utf8", input }).trim();

const waitForDatabase = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      docker(["exec", "-i", containerName, "mysql", "-uroot", "-prootpass", "--batch", "--skip-column-names"], "SELECT 1;");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("MySQL test container did not become ready");
};

const mysql = (sql: string) => docker(
  ["exec", "-i", containerName, "mysql", "-uroot", "-prootpass", "--batch", "--skip-column-names"],
  sql,
);

const createLegacySchema = async () => {
  mysql(`
    USE ${databaseName};
    CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT);
    CREATE TABLE departments (id INT PRIMARY KEY AUTO_INCREMENT);
    CREATE TABLE meeting_rooms (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(200) NOT NULL);
    CREATE TABLE meeting_bookings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      room_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending'
    );
  `);
};

const applyMigration = async () => {
  if (!existsSync(migrationPath)) return { outcome: "migration-missing" as const };
  try {
    mysql(`USE ${databaseName};\n${readFileSync(migrationPath, "utf8")}`);
    return { outcome: "migrated" as const };
  } catch (error) {
    return { outcome: "failed" as const, error: String((error as { stderr?: string }).stderr ?? error) };
  }
};

describe.skipIf(!enabled)("conference booking migration", () => {
  beforeAll(async () => {
    docker(["run", "--rm", "-d", "--name", containerName, "-e", "MYSQL_ROOT_PASSWORD=rootpass", "mysql:8.4"]);
    await waitForDatabase();
  }, 60_000);

  beforeEach(async () => {
    mysql(`DROP DATABASE IF EXISTS ${databaseName}; CREATE DATABASE ${databaseName}; USE ${databaseName};`);
    await createLegacySchema();
  });

  afterAll(async () => {
    try {
      docker(["rm", "-f", containerName]);
    } catch {
      // Docker's --rm can remove the container before cleanup runs.
    }
  });

  it("stops before deleting legacy data", async () => {
    mysql(`USE ${databaseName}; INSERT INTO meeting_rooms (name) VALUES ('Existing room');`);

    const result = await applyMigration();

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") expect(result.error).toContain("legacy_meeting_tables_must_be_empty");
    expect(Number(mysql(`USE ${databaseName}; SELECT COUNT(*) FROM meeting_rooms;`))).toBe(1);
  });

  it("replaces empty legacy tables with conference-link bookings", async () => {
    const result = await applyMigration();

    expect(result).toEqual({ outcome: "migrated" });
    const columns = mysql(`USE ${databaseName}; SHOW COLUMNS FROM meeting_bookings;`)
      .split("\n")
      .map((line) => line.split("\t")[0]);
    expect(columns).toEqual(expect.arrayContaining(["link_id", "start_at", "end_at"]));
    expect(columns).not.toContain("room_id");
  });
});
