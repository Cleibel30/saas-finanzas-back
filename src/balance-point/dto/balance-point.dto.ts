import { IsDateString, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class BalancePointDto {
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