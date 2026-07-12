import { Controller, Get, Post, Body, Param, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles('admin', 'finance')
  createInvoice(@Body() createInvoiceDto: any) {
    return this.invoicesService.createInvoice(createInvoiceDto);
  }

  @Get(':id/pdf')
  @Roles('admin', 'finance')
  async generatePDF(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.invoicesService.generatePDF(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.send(pdf);
  }

  @Post(':id/send')
  @Roles('admin', 'finance')
  sendInvoice(@Param('id') id: string) {
    return this.invoicesService.sendInvoice(id);
  }

  @Get(':id')
  @Roles('admin', 'finance')
  getInvoice(@Param('id') id: string) {
    return this.invoicesService.getInvoice(id);
  }
}
