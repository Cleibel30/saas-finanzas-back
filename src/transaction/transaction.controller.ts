import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { GetTransactionsFilteredDto } from './dto/get-transactions-filtered.dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('transaction')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('create/:companyId')
  async createTransactions(
    @Body(new ParseArrayPipe({ items: CreateTransactionDto }))
    createTransactionDto: CreateTransactionDto[],
    @Param('companyId') companyId: string,
  ) {
    return this.transactionService.createTransactions(
      createTransactionDto,
      companyId,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-all/:companyId')
  async getTransactionsByCompany(
    @Param('companyId') companyId: string,
    @Query() filters: GetTransactionsFilteredDto,
  ) {
    return this.transactionService.getTransactionsByCompany(companyId, filters);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-by-id/:companyId/:transactionId')
  async getTransactionById(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.getTransactionById(transactionId, companyId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Patch('update/:companyId/:transactionId')
  async updateTransaction(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionService.updateTransaction(
      transactionId,
      companyId,
      updateTransactionDto,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Delete('delete/:companyId/:transactionId')
  async deleteTransaction(
    @Param('companyId') companyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.deleteTransaction(transactionId, companyId);
  }
}
