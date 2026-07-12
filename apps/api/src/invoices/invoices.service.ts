import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceLineItem } from '@payflow/database';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private lineItemRepository: Repository<InvoiceLineItem>,
  ) {}

  async createInvoice(createInvoiceDto: any) {
    const invoice = this.invoiceRepository.create({
      ...createInvoiceDto,
      status: 'draft',
      invoiceNumber: this.generateInvoiceNumber(),
      dueDate: this.calculateDueDate(createInvoiceDto.paymentTerms),
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Create line items
    const lineItems = createInvoiceDto.lineItems.map((item: any) =>
      this.lineItemRepository.create({
        ...item,
        invoiceId: savedInvoice.id,
      }),
    );

    await this.lineItemRepository.save(lineItems);

    return this.invoiceRepository.findOne({
      where: { id: savedInvoice.id },
      relations: ['lineItems'],
    });
  }

  async generatePDF(invoiceId: string): Promise<Buffer> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['lineItems', 'organization', 'customer'],
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Add invoice header
    doc.fontSize(20).text(`Invoice #${invoice.invoiceNumber}`, 50, 50);
    doc.fontSize(12).text(`Date: ${invoice.createdAt.toLocaleDateString()}`, 50, 80);
    doc.text(`Due: ${invoice.dueDate.toLocaleDateString()}`, 50, 100);

    // Add customer info
    doc.fontSize(14).text('Bill To:', 50, 140);
    doc.fontSize(10).text(invoice.customer.name, 50, 160);
    doc.text(invoice.customer.email, 50, 175);

    // Add line items table
    let y = 220;
    doc.fontSize(12).text('Description', 50, y);
    doc.text('Quantity', 250, y);
    doc.text('Price', 350, y);
    doc.text('Total', 450, y);

    y += 30;
    for (const item of invoice.lineItems) {
      doc.text(item.description, 50, y);
      doc.text(item.quantity.toString(), 250, y);
      doc.text(`$${item.unitPrice.toFixed(2)}`, 350, y);
      doc.text(`$${(item.quantity * item.unitPrice).toFixed(2)}`, 450, y);
      y += 25;
    }

    // Add totals
    y += 20;
    const subtotal = invoice.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const tax = subtotal * (invoice.taxRate / 100);
    const total = subtotal + tax;

    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 350, y);
    doc.text(`Tax (${invoice.taxRate}%): $${tax.toFixed(2)}`, 350, y + 20);
    doc.fontSize(14).text(`Total: $${total.toFixed(2)}`, 350, y + 45);

    doc.end();

    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async sendInvoice(invoiceId: string) {
    const pdf = await this.generatePDF(invoiceId);
    // Send email with PDF attachment
    // Implementation depends on email service
    return { success: true, message: 'Invoice sent successfully' };
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  private calculateDueDate(paymentTerms: string): Date {
    const date = new Date();
    const days = parseInt(paymentTerms.replace(/\D/g, '')) || 30;
    date.setDate(date.getDate() + days);
    return date;
  }
}
