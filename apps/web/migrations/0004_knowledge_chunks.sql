-- CreateTable
CREATE TABLE "KnowledgeBundleChunk" (
    "releaseVersion" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "data" TEXT NOT NULL,

    PRIMARY KEY ("releaseVersion", "system", "ordinal"),
    CONSTRAINT "KnowledgeBundleChunk_releaseVersion_fkey" FOREIGN KEY ("releaseVersion") REFERENCES "KnowledgeRelease" ("version") ON DELETE CASCADE ON UPDATE CASCADE
);
