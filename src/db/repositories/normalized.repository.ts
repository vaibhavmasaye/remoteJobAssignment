import { prisma } from '../prisma';
import { Person, Payment, CalendarEvent } from '../../generated/prisma';

export class NormalizedRepository {
  // ============================================================================
  // PERSON OPERATIONS
  // ============================================================================

  async createOrUpdatePerson(data: {
    id: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: string;
  }): Promise<Person> {
    return prisma.person.upsert({
      where: { id: data.id },
      update: {
        fullName: data.fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        status: data.status,
        updatedAt: new Date(),
      },
      create: {
        id: data.id,
        fullName: data.fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        status: data.status,
      },
    });
  }

  async getPerson(id: string): Promise<Person | null> {
    return prisma.person.findUnique({ where: { id } });
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  async createOrUpdatePayment(data: {
    id: string;
    customerExternalId?: string;
    amountMinor: bigint;
    currency: string;
    status: string;
    paymentMethodType?: string;
    paidAt?: Date;
    refundedAmountMinor?: bigint;
  }): Promise<Payment> {
    return prisma.payment.upsert({
      where: { id: data.id },
      update: {
        customerExternalId: data.customerExternalId,
        amountMinor: data.amountMinor,
        currency: data.currency,
        status: data.status,
        paymentMethodType: data.paymentMethodType,
        paidAt: data.paidAt,
        refundedAmountMinor: data.refundedAmountMinor || 0n,
        updatedAt: new Date(),
      },
      create: {
        id: data.id,
        customerExternalId: data.customerExternalId,
        amountMinor: data.amountMinor,
        currency: data.currency,
        status: data.status,
        paymentMethodType: data.paymentMethodType,
        paidAt: data.paidAt,
        refundedAmountMinor: data.refundedAmountMinor || 0n,
      },
    });
  }

  async getPayment(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { id } });
  }

  async getPaymentsByCustomer(customerExternalId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { customerExternalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // CALENDAR EVENT OPERATIONS
  // ============================================================================

  async createOrUpdateCalendarEvent(data: {
    id: string;
    calendarExternalId: string;
    summary?: string;
    description?: string;
    startAt?: Date;
    endAt?: Date;
    isAllDay?: boolean;
    timezone?: string;
    status: string;
    organizerEmail?: string;
    attendees?: any;
    recurringEventExternalId?: string;
  }): Promise<CalendarEvent> {
    return prisma.calendarEvent.upsert({
      where: { id: data.id },
      update: {
        calendarExternalId: data.calendarExternalId,
        summary: data.summary,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        isAllDay: data.isAllDay || false,
        timezone: data.timezone,
        status: data.status,
        organizerEmail: data.organizerEmail,
        attendees: data.attendees,
        recurringEventExternalId: data.recurringEventExternalId,
        updatedAt: new Date(),
      },
      create: {
        id: data.id,
        calendarExternalId: data.calendarExternalId,
        summary: data.summary,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        isAllDay: data.isAllDay || false,
        timezone: data.timezone,
        status: data.status,
        organizerEmail: data.organizerEmail,
        attendees: data.attendees,
        recurringEventExternalId: data.recurringEventExternalId,
      },
    });
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | null> {
    return prisma.calendarEvent.findUnique({ where: { id } });
  }

  async getCalendarEventsByCalendar(calendarExternalId: string): Promise<CalendarEvent[]> {
    return prisma.calendarEvent.findMany({
      where: { calendarExternalId },
      orderBy: { startAt: 'asc' },
    });
  }
}

export const normalizedRepository = new NormalizedRepository();
