export type User = {
  id: number;
  name: string;
  email: string;
};

export type CreateUserDto = Omit<User, 'id'>;

export type UpdateUserDto = Partial<CreateUserDto>;
