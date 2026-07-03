import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CashFlowDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}
