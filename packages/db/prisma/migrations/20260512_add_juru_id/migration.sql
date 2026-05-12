ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "juruId" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "office" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "employees_juruId_key" ON "employees"("juruId");
