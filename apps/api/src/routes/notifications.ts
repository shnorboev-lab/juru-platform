import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, getEmployee, requireRole } from '../lib/auth.js'

export async function notificationRoutes(app: FastifyInstance) {
  // My notifications — handles both /notifications and /notifications?limit=N
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { limit } = req.query as { limit?: string }
    return prisma.notification.findMany({
      where: { employeeId: emp.id },
      orderBy: { createdAt: 'desc' },
      take: limit ? Math.min(parseInt(limit), 200) : 50,
    })
  })

  // HR: global notification log across all employees
  app.get('/admin', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { limit } = req.query as { limit?: string }
    return prisma.notification.findMany({
      include: { employee: { select: { fullName: true, juruId: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? Math.min(parseInt(limit), 500) : 100,
    })
  })

  // Mark as read
  app.patch('/:id/read', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.notification.update({ where: { id }, data: { status: 'SENT' } })
  })
}
