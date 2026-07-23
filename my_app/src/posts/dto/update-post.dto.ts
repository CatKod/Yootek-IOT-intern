import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
