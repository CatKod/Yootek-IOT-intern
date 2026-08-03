import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @ApiProperty({ example: 'a@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password!: string;
}
