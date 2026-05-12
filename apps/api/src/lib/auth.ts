import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma, Role } from '@juru/db'

export interface JWTPayload {
  sub: string   // employee id
  email: string
  role: Role
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply)
    const payload = req.user as JWTPayload
    if (!roles.includes(payload.role)) {
      reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

export async function getEmployee(req: FastifyRequest) {
  const payload = req.user as JWTPayload
  return prisma.employee.findUniqueOrThrow({ where: { id: payload.sub } })
}
