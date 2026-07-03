import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ContributionMarginServiceDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

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

export class ContributionMarginProductDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

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

export class GeneralContributionMargin {
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
