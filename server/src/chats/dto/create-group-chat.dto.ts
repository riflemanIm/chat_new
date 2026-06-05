import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class CreateGroupChatDto {
  @ApiProperty({ example: 'Project team' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({ example: 'https://example.com/group.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  memberIds: string[];
}
