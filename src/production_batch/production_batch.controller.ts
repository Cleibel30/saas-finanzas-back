import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ProductionBatchService } from './production_batch.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateBatchWithTransactionsDto } from './dto/batch.dto';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';

@Controller('production-batch')
export class ProductionBatchController {
    constructor(private productionBatchService: ProductionBatchService) { }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Post('create/:companyId/:itemId')
    async createBatchWithTransactions(
        @Param('companyId') companyId: string,
        @Param('itemId') itemId: string,
        @Body() dto: CreateBatchWithTransactionsDto
    ) {
        return await this.productionBatchService.createBatchAndTransactions(companyId, itemId, dto);
    }
}
