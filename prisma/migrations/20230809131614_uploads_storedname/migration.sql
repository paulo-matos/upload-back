/*
  Warnings:

  - Added the required column `File_Stored_Name` to the `Uploads` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Uploads" (
    "Id" TEXT NOT NULL PRIMARY KEY,
    "File_Name" TEXT NOT NULL,
    "File_Stored_Name" TEXT NOT NULL,
    "Path" TEXT NOT NULL,
    "Created_At" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Uploads" ("Created_At", "File_Name", "Id", "Path") SELECT "Created_At", "File_Name", "Id", "Path" FROM "Uploads";
DROP TABLE "Uploads";
ALTER TABLE "new_Uploads" RENAME TO "Uploads";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
