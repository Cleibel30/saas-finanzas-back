import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class PriceMarginDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(0)
  targetMarginPercent!: number;
}
