import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'alice' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'Alice Johnson', required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;
}
