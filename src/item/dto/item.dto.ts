import { ItemType } from "@prisma/client";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsString, MaxLength, Min, MinLength } from "class-validator";


export class CreateItemDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name!: string;

    @IsEnum(ItemType)
    type!: ItemType;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    basePrice!: number;

    @IsNumber()
    @Min(0)
    stockCurrent?: number;
    
    @IsBoolean()
    isVariable!: boolean;
}

export class UpdateItemDto {
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    name?: string;

    @IsEnum(ItemType)
    type?: ItemType;

    @IsNumber()
    @Min(0)
    basePrice?: number;

    @IsNumber()
    @Min(0)
    stockCurrent?: number;

    @IsBoolean()
    isVariable?: boolean;
}