import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";


export class CreateCompanyDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name!: string
}
