import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { PrismaClient } from '@/generated/prisma';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '@/prisma/prisma.service';


@Injectable()
export class AuthService {
  private supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

  constructor(private prisma: PrismaService) { }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }


  async register(registerData: RegisterDto) {
    const { name, email, password, repeat_password } = registerData;

    if (password !== repeat_password) throw new BadRequestException('Passwords do not match');

    const userExists = await this.prisma.user.findUnique({ where: { email } });
    if (userExists) throw new ConflictException('User already exists');

    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }, 
        emailRedirectTo: `${process.env.FRONTEND_URL}/sesion`
      }
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new InternalServerErrorException('Error creating user in Supabase');

      return authData;
    }

    try {
      const hashedPassword = await this.hashPassword(password);

      const newUser = await this.prisma.user.create({
        data: {
          id: authData.user.id, // Sincronizamos el UUID de Supabase
          email,
          name,
          passwordHash: hashedPassword, // Opcional si solo usas Supabase, pero útil para respaldo
        },
      });


      if (!authData.session) {
        return {
          message: 'CONFIRM_EMAIL_REQUIRED',
          description: 'Hemos enviado un enlace a tu correo. Por favor, confírmalo.',
        };
      }


      return {
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      };
    } catch (error) {
      // Si falla Prisma, deberíamos considerar qué hacer con el usuario de Supabase
      // (Opcional: implementar un rollback o usar Triggers en SQL como mencioné antes)
      throw new InternalServerErrorException('Error saving user to database');
    }
  }

  async login(loginData: LoginDto) {
    const { email, password } = loginData;

    // Autenticamos con Supabase
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException(`Invalid credentials - ${error.message}`);
    }

    return {
      access_token: data.session.access_token,
      user: data.user,
    };
  }

}

