import { CategoryType } from "@prisma/client";
import { FlowDirection } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name!: string;

    @IsEnum(CategoryType)
    type!: CategoryType;

    @IsEnum(FlowDirection)
    flowDirection!: FlowDirection;
}


export class UpdateCategoryDto {
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    name?: string;

    @IsEnum(CategoryType)
    type?: CategoryType;

    @IsEnum(FlowDirection)
    flowDirection?: FlowDirection;
}