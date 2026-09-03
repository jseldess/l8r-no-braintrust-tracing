import { prisma } from '../prisma'

export interface PaymentFilters {
  status?: string
  planId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export const paymentService = {
  async getPayments(userId: string, filters?: PaymentFilters) {
    const where: Record<string, unknown> = { userId }

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.planId) {
      where.planId = filters.planId
    }

    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {}
      if (filters.startDate) {
        (where.dueDate as Record<string, Date>).gte = filters.startDate
      }
      if (filters.endDate) {
        (where.dueDate as Record<string, Date>).lte = filters.endDate
      }
    }

    return prisma.payment.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: filters?.limit || 50,
      include: {
        plan: {
          include: {
            order: {
              select: {
                id: true,
                merchantName: true,
                merchantCategory: true,
              },
            },
          },
        },
      },
    })
  },

  async getPaymentById(paymentId: string, userId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        plan: {
          include: {
            order: true,
          },
        },
      },
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    return payment
  },

  async getUpcomingPayments(userId: string, limit = 5) {
    const now = new Date()
    return prisma.payment.findMany({
      where: {
        userId,
        status: { in: ['scheduled', 'pending'] },
        dueDate: { gte: now },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
      include: {
        plan: {
          include: {
            order: {
              select: {
                id: true,
                merchantName: true,
              },
            },
          },
        },
      },
    })
  },

  async getFailedPayments(userId: string) {
    return prisma.payment.findMany({
      where: {
        userId,
        status: 'failed',
      },
      orderBy: { dueDate: 'desc' },
      include: {
        plan: {
          include: {
            order: {
              select: {
                id: true,
                merchantName: true,
              },
            },
          },
        },
      },
    })
  },

  async retryPayment(paymentId: string, userId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: { plan: true },
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    if (payment.status !== 'failed') {
      throw new Error('Can only retry failed payments')
    }

    // Simulate payment retry - in real app would call payment processor
    const success = Math.random() > 0.1 // 90% success rate for demo

    if (success) {
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'paid',
          paidDate: new Date(),
          failureReason: null,
        },
        include: {
          plan: {
            include: {
              order: {
                select: {
                  id: true,
                  merchantName: true,
                },
              },
            },
          },
        },
      })

      // Update plan remaining amount
      await prisma.installmentPlan.update({
        where: { id: payment.planId },
        data: {
          remainingAmount: { decrement: payment.amount },
        },
      })

      return {
        success: true,
        payment: updatedPayment,
        message: `Payment of $${payment.amount.toFixed(2)} was successful`,
      }
    } else {
      return {
        success: false,
        payment,
        message: 'Payment retry failed. Please try again or update your payment method.',
      }
    }
  },

  async getPaymentHistory(
    userId: string,
    filters?: { status?: string; limit?: number }
  ) {
    // Defaults to completed payments, but any status can be requested so that
    // failed payments are reachable (paidDate is null for those, so order by
    // dueDate instead).
    const status = filters?.status || 'paid'

    return prisma.payment.findMany({
      where: {
        userId,
        status,
      },
      orderBy: status === 'paid' ? { paidDate: 'desc' } : { dueDate: 'desc' },
      take: filters?.limit || 20,
      include: {
        plan: {
          include: {
            order: {
              select: {
                id: true,
                merchantName: true,
              },
            },
          },
        },
      },
    })
  },
}
