import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { TransactionStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { DateRange } from '../validators/date-range.validator';

@DateRange()
export class GetTransactionsFilteredDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}
