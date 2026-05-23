import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class ChatBodyDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    preguntaUsuario!: string;
}