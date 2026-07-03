import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class NetProfitDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}
