import bcrypt from 'bcrypt';

export const hashPassword = async (plainPassword: string) => {
  const saltRounds = 10; // liczba rund soli
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
  }
};

export const comparePasswords = async (
  plainPassword: string,
  hashedPassword: string,
) => {
  try {
    const match = await bcrypt.compare(plainPassword, hashedPassword);
    return match;
  } catch (error) {
    console.error('Error comparing passwords:', error);
  }
};
