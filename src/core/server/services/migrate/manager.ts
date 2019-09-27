import fs from "fs-extra";
import { Db } from "mongodb";
import path from "path";
import now from "performance-now";

import logger from "coral-server/logger";
import {
  createFailedMigrationRecord,
  createMigrationRecord,
  createSkippedMigrationRecords,
  retrieveAllMigrationRecords,
} from "coral-server/models/migration";
import TenantCache from "coral-server/services/tenant/cache";

import { FailedMigrationDetectedError } from "./error";
import Migration from "./migration";

// Extract the version from the filename with this regex.
const fileNamePattern = /^(\d+)_([\S_]+)\.[tj]s$/;

export default class Manager {
  private migrations: Migration[];
  private tenants: TenantCache;
  private ran: boolean = false;

  constructor(tenants: TenantCache) {
    this.migrations = [];
    this.tenants = tenants;

    const fileNames = fs.readdirSync(path.join(__dirname, "migrations"));
    for (const fileName of fileNames) {
      // Test to see if this fileName is one of our migrations.
      if (!fileNamePattern.test(fileName)) {
        if (fileName.endsWith(".map")) {
          // This was a mapping file (in production), skip this.
          continue;
        }

        logger.warn(
          { fileName },
          "found a file in the migrations folder that did not have an expected format"
        );
        continue;
      }

      // Load the migration.
      const filePath = path.join(__dirname, "migrations", fileName);
      const m = require(filePath);

      // Parse the timestamp out of the migration filename.
      const matches = fileName.match(fileNamePattern);
      if (!matches || matches.length !== 3) {
        throw new Error("fileName format is invalid");
      }
      const version = parseInt(matches[1], 10);

      // Create the migration instance.
      const migration = new m.default(version, matches[2]);

      // Insert the migration into the migrations array.
      if (!(migration instanceof Migration)) {
        throw new Error(`migration at ${filePath} did not export a Migration`);
      }

      this.migrations.push(migration);
    }

    // Sort the migrations.
    this.migrations.sort((a, b) => {
      if (a.version < b.version) {
        return -1;
      }

      if (a.version > b.version) {
        return 1;
      }

      return 0;
    });
  }

  /**
   * pending will return the pending migrations that need to be completed.
   *
   * @param mongo the database handle to use to get the migrations
   */
  private async pending(mongo: Db): Promise<Migration[]> {
    const records = await retrieveAllMigrationRecords(mongo);

    // Check to see if any of the migrations have failed.
    records.forEach(record => {
      if (record.failed) {
        throw new FailedMigrationDetectedError(record);
      }
    });

    return this.migrations.filter(
      migration =>
        !Boolean(records.find(record => migration.version === record.version))
    );
  }

  private async currentMigration(mongo: Db) {
    const records = await retrieveAllMigrationRecords(mongo);
    return records.length > 0 ? records[records.length - 1] : null;
  }

  public async skipPendingMigrations(mongo: Db) {
    // Error out if this is ran twice.
    if (this.ran) {
      throw new Error("pending migrations have already been executed");
    }

    // Mark the migrations as ran.
    this.ran = true;

    // Check the current migration version.
    const currentMigration = await this.currentMigration(mongo);
    if (currentMigration) {
      throw new Error(
        "tried to skip migrations when there is incomplete migrations already in the database"
      );
    }

    // Mark all the migrations as skipped.
    await createSkippedMigrationRecords(
      mongo,
      this.migrations.map(migration => migration.version)
    );

    logger.info(
      { migrations: this.migrations.length },
      "marked migrations as skipped"
    );
  }

  public async executePendingMigrations(mongo: Db) {
    // Error out if this is ran twice.
    if (this.ran) {
      throw new Error("pending migrations have already been executed");
    }

    // Mark the migrations as ran.
    this.ran = true;

    // Check the current migration version.
    let currentMigration = await this.currentMigration(mongo);

    // Determine which migrations need to be ran.
    const pending = await this.pending(mongo);
    if (pending.length === 0) {
      logger.info(
        {
          currentMigrationVersion: currentMigration
            ? currentMigration.version
            : null,
        },
        "there was no pending migrations to run"
      );
      return;
    }

    logger.info({ pending: pending.length }, "executing pending migrations");

    const migrationsStartTime = now();

    for (const migration of pending) {
      let log = logger.child(
        {
          migrationName: migration.name,
          migrationVersion: migration.version,
        },
        true
      );

      for await (const tenant of this.tenants) {
        log = log.child({ tenantID: tenant.id }, true);

        const migrationStartTime = now();
        log.info("starting migration");

        try {
          // Run the migration.
          await migration.up(mongo, tenant.id);

          // Test the migration.
          if (migration.test) {
            await migration.test(mongo, tenant.id);
          }
        } catch (err) {
          // The migration or test has failed, try to roll back the operation.
          if (migration.down) {
            log.error({ err }, "migration has failed, attempting rollback");

            // Attempt the down migration.
            await migration.down(mongo, tenant.id);
          } else {
            log.error(
              { err },
              "migration has failed, and does not have a down method available, migration will not be rolled back"
            );
          }

          // Mark the migration as failed.
          await createFailedMigrationRecord(mongo, migration.version);

          // Rethrow the error here to cause the application to crash.
          throw err;
        }

        const executionTime = Math.round(now() - migrationStartTime);
        log.info({ executionTime }, "finished migration");
      }

      // Mark the migration as completed.
      await createMigrationRecord(mongo, migration.version);
    }

    const finishTime = Math.round(now() - migrationsStartTime);

    currentMigration = await this.currentMigration(mongo);

    logger.info(
      {
        finishTime,
        currentMigrationVersion: currentMigration
          ? currentMigration.version
          : null,
      },
      "finished running pending migrations"
    );
  }
}