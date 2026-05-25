import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, requireRole, getEmployee } from '../lib/auth.js'
import { notifyMany } from '../services/notify.js'

export async function checkInRoutes(app: FastifyInstance) {
  // List check-ins — team head sees initiated ones, employee sees received + attended ones
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { employeeId, status } = req.query as { employeeId?: string; status?: string }

    const attendeeInclude = {
      attendees: {
        include: { employee: { select: { id: true, fullName: true, grade: true } } },
      },
    }

    if (['TEAM_HEAD', 'HR_ADMIN'].includes(emp.role)) {
      return prisma.checkIn.findMany({
        where: {
          initiatorId: emp.id,
          ...(employeeId ? { employeeId } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: {
          employee: { select: { id: true, fullName: true, grade: true, juruId: true, team: { select: { name: true } } } },
          ...attendeeInclude,
        },
        orderBy: { scheduledAt: 'desc' },
      })
    }

    // Employee sees their check-ins + ones they were invited to attend
    const [received, attending] = await Promise.all([
      prisma.checkIn.findMany({
        where: { employeeId: emp.id, ...(status ? { status: status as any } : {}) },
        include: { initiator: { select: { id: true, fullName: true } }, ...attendeeInclude },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.checkInAttendee.findMany({
        where: { employeeId: emp.id },
        include: {
          checkIn: {
            include: {
              initiator: { select: { id: true, fullName: true } },
              employee:  { select: { id: true, fullName: true } },
              ...attendeeInclude,
            },
          },
        },
      }),
    ])
    const attendingCheckIns = attending.map(a => ({ ...a.checkIn, myAttendeeId: a.id, myNotes: a.notes, _isAttendee: true }))
    const seen = new Set(received.map(c => c.id))
    return [...received, ...attendingCheckIns.filter(c => !seen.has(c.id))]
  })

  // Get single check-in
  app.get('/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.checkIn.findUniqueOrThrow({
      where: { id },
      include: {
        initiator: { select: { id: true, fullName: true } },
        employee:  { select: { id: true, fullName: true, grade: true, team: { select: { name: true } } } },
        attendees: { include: { employee: { select: { id: true, fullName: true, grade: true } } } },
      },
    })
  })

  // Add attendee to check-in
  app.post('/:id/attendees', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const actor = await getEmployee(req)
    const { employeeId } = req.body as { employeeId: string }

    const checkIn = await prisma.checkIn.findUniqueOrThrow({
      where: { id },
      include: { employee: { select: { fullName: true } }, initiator: { select: { fullName: true } } },
    })

    const attendee = await prisma.checkInAttendee.create({
      data: { checkInId: id, employeeId },
    })

    await notifyMany([employeeId], {
      event:    'CHECK_IN_SCHEDULED',
      channels: ['EMAIL', 'IN_APP'],
      subject:  `You've been invited to a 1:1 interview — ${checkIn.employee.fullName}`,
      body:     `<b>${checkIn.initiator.fullName}</b> has invited you to attend the performance interview for <b>${checkIn.employee.fullName}</b>${checkIn.scheduledAt ? ` on <b>${new Date(checkIn.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</b>` : ''}.`,
    })

    return reply.status(201).send(attendee)
  })

  // Remove attendee
  app.delete('/:id/attendees/:employeeId', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req, reply) => {
    const { id, employeeId } = req.params as { id: string; employeeId: string }
    await prisma.checkInAttendee.deleteMany({ where: { checkInId: id, employeeId } })
    return reply.status(204).send()
  })

  // Attendee submits their opinion/notes
  app.patch('/:id/attendees/:employeeId/notes', { preHandler: requireAuth }, async (req) => {
    const { id, employeeId } = req.params as { id: string; employeeId: string }
    const { notes } = req.body as { notes: string }
    return prisma.checkInAttendee.update({
      where: { checkInId_employeeId: { checkInId: id, employeeId } },
      data: { notes },
    })
  })

  // Create check-in — team head / HR only
  app.post('/', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req, reply) => {
    const actor = await getEmployee(req)
    const { employeeId, scheduledAt, agenda } = req.body as {
      employeeId: string
      scheduledAt?: string
      agenda?: string
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        initiatorId: actor.id,
        employeeId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        agenda,
      },
      include: {
        employee: { select: { id: true, fullName: true } },
      },
    })

    const dateStr = scheduledAt ? new Date(scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD'
    await notifyMany([employeeId], {
      event:    'CHECK_IN_SCHEDULED',
      channels: ['EMAIL', 'IN_APP'],
      subject:  `1:1 Check-in scheduled — ${actor.fullName}`,
      body:     `<b>${actor.fullName}</b> has scheduled a 1:1 check-in with you on <b>${dateStr}</b>.${agenda ? `<br/>Agenda: ${agenda}` : ''}`,
    })

    return reply.status(201).send(checkIn)
  })

  // Update agenda / reschedule / update notes — initiator or HR
  app.patch('/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const { scheduledAt, agenda, notes, status } = req.body as {
      scheduledAt?: string
      agenda?: string
      notes?: string
      status?: string
    }
    return prisma.checkIn.update({
      where: { id },
      data: {
        ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(agenda      !== undefined ? { agenda }                             : {}),
        ...(notes       !== undefined ? { notes }                              : {}),
        ...(status                    ? { status: status as any }              : {}),
      },
    })
  })

  // Employee adds their own notes
  app.patch('/:id/employee-notes', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const { employeeNotes } = req.body as { employeeNotes: string }
    return prisma.checkIn.update({ where: { id }, data: { employeeNotes } })
  })

  // Complete check-in + share notes with employee
  app.post('/:id/complete', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req) => {
    const { id } = req.params as { id: string }
    const { notes } = req.body as { notes?: string }

    const checkIn = await prisma.checkIn.update({
      where: { id },
      data: { status: 'DONE', ...(notes !== undefined ? { notes } : {}) },
      include: {
        initiator: { select: { fullName: true } },
        employee:  { select: { id: true, fullName: true } },
      },
    })

    if (checkIn.notes) {
      await notifyMany([checkIn.employeeId], {
        event:    'CHECK_IN_COMPLETED',
        channels: ['EMAIL', 'IN_APP'],
        subject:  `1:1 Check-in notes from ${checkIn.initiator.fullName}`,
        body:     `Your 1:1 check-in with <b>${checkIn.initiator.fullName}</b> is complete. Notes:<br/><br/>${checkIn.notes}`,
      })
    }

    return checkIn
  })
}
