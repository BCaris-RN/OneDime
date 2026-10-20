import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The integration suite shares one PostgreSQL container and global rung_claims keys.
    // Run files serially so one file cannot race another while resetting shared tables.
    fileParallelism: false,
  },
});
