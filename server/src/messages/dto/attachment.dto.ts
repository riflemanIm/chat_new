import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class AttachmentDto {
  @ApiPropertyOptional({ example: 'https://example.com/file.pdf' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: 'file.pdf' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 12345 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}
