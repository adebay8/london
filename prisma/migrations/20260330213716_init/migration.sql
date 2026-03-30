-- CreateTable
CREATE TABLE "neighbourhoods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "postcodes" TEXT NOT NULL,
    "status" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "research_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neighbourhoodId" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "safety" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "rentValue" TEXT NOT NULL,
    "newBuilds" TEXT NOT NULL,
    "amenities" TEXT NOT NULL,
    "areaQuality" TEXT NOT NULL,
    "pros" TEXT NOT NULL,
    "cons" TEXT NOT NULL,
    "fitScore" REAL NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "researchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelUsed" TEXT NOT NULL,
    CONSTRAINT "research_profiles_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "research_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neighbourhoodId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "research_jobs_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neighbourhoodId" TEXT,
    "content" TEXT NOT NULL,
    "decision" TEXT,
    "fitScoreSnapshot" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_entries_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "neighbourhoods_name_borough_key" ON "neighbourhoods"("name", "borough");

-- CreateIndex
CREATE UNIQUE INDEX "research_profiles_neighbourhoodId_key" ON "research_profiles"("neighbourhoodId");
