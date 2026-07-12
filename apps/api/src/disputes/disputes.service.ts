import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, Payment } from '@payflow/database';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
}

export enum DisputeReason {
  UNAUTHORIZED = 'unauthorized',
  PRODUCT_NOT_RECEIVED = 'product_not_received',
  PRODUCT_DIFFERENT = 'product_different',
  DUPLICATE = 'duplicate',
  CREDIT_NOT_PROCESSED = 'credit_not_processed',
  OTHER = 'other',
}

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectQueue('disputes')
    private disputeQueue: Queue,
  ) {}

  async createDispute(createDisputeDto: {
    paymentId: string;
    reason: DisputeReason;
    description: string;
    evidence?: string[];
  }) {
    const payment = await this.paymentRepository.findOne({
      where: { id: createDisputeDto.paymentId },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'succeeded') {
      throw new BadRequestException('Can only dispute successful payments');
    }

    // Check if dispute already exists
    const existingDispute = await this.disputeRepository.findOne({
      where: { paymentId: createDisputeDto.paymentId },
    });

    if (existingDispute) {
      throw new BadRequestException('Dispute already exists for this payment');
    }

    const dispute = this.disputeRepository.create({
      ...createDisputeDto,
      status: DisputeStatus.OPEN,
      amount: payment.amount,
      currency: payment.currency,
    });

    const savedDispute = await this.disputeRepository.save(dispute);

    // Notify relevant parties
    await this.disputeQueue.add('notify-new-dispute', {
      disputeId: savedDispute.id,
      paymentId: payment.id,
    });

    return savedDispute;
  }

  async updateDisputeStatus(
    disputeId: string,
    status: DisputeStatus,
    resolutionNote?: string,
  ) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');

    dispute.status = status;
    dispute.resolutionNote = resolutionNote;
    dispute.resolvedAt = status === DisputeStatus.RESOLVED ? new Date() : null;

    const updated = await this.disputeRepository.save(dispute);

    // Handle resolution actions
    if (status === DisputeStatus.RESOLVED) {
      await this.handleResolution(updated);
    }

    return updated;
  }

  async addEvidence(disputeId: string, evidence: string[]) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');

    dispute.evidence = [...(dispute.evidence || []), ...evidence];
    return this.disputeRepository.save(dispute);
  }

  async getDisputes(filters?: {
    status?: DisputeStatus;
    paymentId?: string;
    organizationId?: string;
  }) {
    const query = this.disputeRepository.createQueryBuilder('dispute');

    if (filters?.status) {
      query.andWhere('dispute.status = :status', { status: filters.status });
    }

    if (filters?.paymentId) {
      query.andWhere('dispute.paymentId = :paymentId', {
        paymentId: filters.paymentId,
      });
    }

    if (filters?.organizationId) {
      query
        .innerJoin('dispute.payment', 'payment')
        .andWhere('payment.organizationId = :organizationId', {
          organizationId: filters.organizationId,
        });
    }

    return query.getMany();
  }

  private async handleResolution(dispute: Dispute) {
    // If dispute resolved in customer's favor, refund the payment
    if (dispute.resolutionNote?.toLowerCase().includes('refund')) {
      // Trigger refund process
      await this.disputeQueue.add('process-refund', {
        paymentId: dispute.paymentId,
        disputeId: dispute.id,
      });
    }

    // Notify parties
    await this.disputeQueue.add('notify-resolution', {
      disputeId: dispute.id,
      status: dispute.status,
    });
  }

  async escalateDispute(disputeId: string, reason: string) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');

    dispute.status = DisputeStatus.ESCALATED;
    dispute.escalationReason = reason;
    dispute.escalatedAt = new Date();

    return this.disputeRepository.save(dispute);
  }
}
