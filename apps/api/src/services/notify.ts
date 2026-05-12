import nodemailer from 'nodemailer'
import { prisma, NotificationChannel } from '@juru/db'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

async function sendGChat(subject: string, body: string) {
  const webhookUrl = process.env.GCHAT_WEBHOOK_URL
  if (!webhookUrl) return
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${subject}*\n${body}` }),
  })
}

export interface NotifyPayload {
  employeeId: string
  event: string
  subject: string
  body: string
  channels?: NotificationChannel[]
}

export async function notify(payload: NotifyPayload) {
  const channels = payload.channels ?? [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
  const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId } })
  if (!employee) return

  for (const channel of channels) {
    const record = await prisma.notification.create({
      data: {
        employeeId: payload.employeeId,
        channel,
        event:   payload.event,
        subject: payload.subject,
        body:    payload.body,
        status:  'PENDING',
      },
    })

    try {
      if (channel === NotificationChannel.EMAIL) {
        await transporter.sendMail({
          from:    process.env.EMAIL_FROM ?? 'Juru HR <noreply@juru.org>',
          to:      employee.email,
          subject: payload.subject,
          html:    emailTemplate(payload.subject, payload.body, employee.fullName),
        })
      } else if (channel === NotificationChannel.GCHAT) {
        await sendGChat(payload.subject, payload.body)
      }
      await prisma.notification.update({
        where: { id: record.id },
        data:  { status: 'SENT', sentAt: new Date() },
      })
    } catch (err) {
      console.error(`Notification failed [${channel}]:`, err)
      await prisma.notification.update({ where: { id: record.id }, data: { status: 'FAILED' } })
    }
  }
}

export async function notifyMany(employeeIds: string[], payload: Omit<NotifyPayload, 'employeeId'>) {
  await Promise.all(employeeIds.map(id => notify({ ...payload, employeeId: id })))
}

function emailTemplate(subject: string, body: string, name: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#C30017;padding:24px 32px;">
            <img src="https://www.juru.org/images/Logo.svg" alt="Juru" height="32" style="filter:brightness(0) invert(1);">
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#666;font-size:14px;">Hello ${name},</p>
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px;">${subject}</h2>
            <div style="color:#444;font-size:15px;line-height:1.6;">${body}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:12px;">Juru Performance Review Platform · <a href="https://juru.org" style="color:#C30017;">juru.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
