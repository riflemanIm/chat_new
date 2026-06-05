import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateChatDto {
  @ApiPropertyOptional({ example: 'New group name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ example: 'https://example.com/group.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
