import { PrismaClient } from '@prisma/client'
import prismaEnums from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Enum values — loaded from the CJS default export for ESM/CJS interop
export const Role             = prismaEnums.Role
export const Grade            = prismaEnums.Grade
export const SeniorityTier    = prismaEnums.SeniorityTier
export const CycleType        = prismaEnums.CycleType
export const CyclePhase       = prismaEnums.CyclePhase
export const SubmissionType   = prismaEnums.SubmissionType
export const SubmissionStatus = prismaEnums.SubmissionStatus
export const PerformanceLabel = prismaEnums.PerformanceLabel
export const SubCriterion     = prismaEnums.SubCriterion
export const NotificationChannel = prismaEnums.NotificationChannel
export const NotificationStatus  = prismaEnums.NotificationStatus

// Enum types (separate namespace from the values above — both can coexist)
export type {
  Role,
  Grade,
  SeniorityTier,
  CycleType,
  CyclePhase,
  SubmissionType,
  SubmissionStatus,
  PerformanceLabel,
  SubCriterion,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client'

// Prisma model types
export type {
  Employee,
  ReviewCycle,
  Assignment,
  Submission,
  Score,
  Result,
  SubCriterionResult,
  Report,
  Notification,
  AuditLog,
  BusinessUnit,
  Team,
} from '@prisma/client'
