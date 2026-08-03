import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Bài viết đầu tiên' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title!: string;

  @ApiPropertyOptional({ example: 'Nội dung bài viết' })
  @IsOptional()
  @IsString()
  content?: string;
}
