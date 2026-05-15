import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';

@Controller('item')
export class ItemController {
    constructor(private itemService: ItemService) { }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Post('create/:companyId')
    async createItems(@Body() createItemDto: CreateItemDto[], @Param('companyId') companyId: string) {
        return this.itemService.createItems(createItemDto, companyId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Patch('update/:itemId/:companyId')
    async updateItem(@Param('itemId') itemId: string, @Param('companyId') companyId: string, @Body() updateData: UpdateItemDto) {
        return this.itemService.updateItem(itemId, companyId, updateData);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('get-all/:companyId')
    async getItemsByCompany(@Param('companyId') companyId: string) {
        return this.itemService.getItemsByCompany(companyId);
    }
}
