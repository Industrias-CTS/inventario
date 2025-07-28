import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
  return bcrypt.hash(password, rounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};