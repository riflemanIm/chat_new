import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ example: 'Edited message' })
  @IsString()
  @MinLength(1)
  text: string;
}
