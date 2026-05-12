import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const scoringQueue = new Queue('scoring', { connection })
export const reportQueue  = new Queue('reports', { connection })
export const notifyQueue  = new Queue('notifications', { connection })

export { connection }
