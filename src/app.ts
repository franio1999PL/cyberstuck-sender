import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sendMail } from './mail/send';
import { comparePasswords, hashPassword } from './utils';

require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

const prisma = new PrismaClient();

const APP_URL: string = process.env.APP_URL || 'localhost:3001';

// Middleware do sprawdzania apiKey
const checkApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const { apikey } = req.headers;

  if (!apikey) {
    return res.status(401).json({
      message: 'Unauthorized',
    });
  }

  const checkToken = await prisma.token
    .findUnique({
      where: {
        token: String(apikey),
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (!checkToken) {
    return res.status(401).json({
      message: 'Unauthorized',
    });
  }

  next();
};

app.get('/', (req: Request, res: Response) => {
  res.redirect('/create/token');
});

// Użycie middleware do sprawdzania apiKey
app.post('/send', checkApiKey, async (req: Request, res: Response) => {
  const { email, subject, text } = req.body;

  const response = await sendMail(email, subject, text);
  await prisma.message
    .create({
      data: {
        id: uuidv4(),
        emailTo: String(email),
        subject: String(subject),
        text: String(text),
      },
    })
    .catch((error) => {
      console.error(error);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
  res.json(response);
});

app.get('/register', (req: Request, res: Response) => {
  res.render('register', { title: 'Rejestracja', message: null });
});

app.post('/register', async (req: Request, res: Response) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).render('register', {
      title: 'Rejestracja',
      message: 'Błędny email lub hasło',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', {
      title: 'Rejestracja',
      message: 'Hasła nie są takie same',
    });
  }

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).render('register', {
      title: 'Rejestracja',
      message: 'Błędny format adresu email',
    });
  }
  if (email !== 'sikorafranek@gmail.com') {
    if (!email.includes('@cyberfolks.pl')) {
      return res.status(400).render('register', {
        title: 'Rejestracja',
        message: 'Nie odpowiednia domena emaila',
      });
    }
  }

  try {
    const userExists = await prisma.user.findUnique({
      where: {
        email: String(email),
      },
    });

    if (userExists) {
      return res.status(409).render('register', {
        title: 'Rejestracja',
        message: 'Taki użytkownik już istnieje w bazie danych',
      });
    }

    const HPassword = await hashPassword(password);

    const createdUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: String(email),
        password: String(HPassword),
        role: 'GUEST',
      },
    });

    if (!createdUser) {
      return res.status(500).render('register', {
        title: 'Rejestracja',
        message: 'Błąd podczas tworzenia użytkownika',
      });
    }

    const activateMessage = await sendMail(
      email,
      'Aktywacja konta',
      `https://${process.env.APP_URL}/user/activate/${String(
        createdUser.id,
      )}?email=${createdUser.email}`,
    );

    console.log(activateMessage);

    return res.render('register', {
      title: 'Rejestracja',
      message:
        'Użytkownik został utworzony. Aktywuj konto klikając w link wysłany na email',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Błąd wewnętrzny serwera');
  } finally {
    await prisma.$disconnect();
  }
});

app.get('/user/activate/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const email = req.query.email;

  if (!id || !email) {
    return res.status(400).json({
      message: 'Błędne zapytanie',
    });
  }

  const user = await prisma.user
    .findUnique({
      where: {
        id: String(id),
        email: String(email),
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (!user) {
    return res.status(404).json({
      message: 'Nie znaleziono takiego użytkownika',
    });
  }

  if (user.role === 'ADMIN' || user.role === 'USER') {
    return res.status(400).json({
      message: 'Adres email został już zweryfikowany',
    });
  }

  const response = await prisma.user
    .update({
      where: {
        id: String(id),
      },
      data: {
        role: 'USER',
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (!response) {
    return res.status(500).json({
      message: 'Wystąpił błąd podczas aktywacji konta',
    });
  }

  res
    .status(200)
    .send(
      'Konto zostało aktywowane. Możesz utworzyć token API aby wysyłać maile.',
    );
});

app.get('/create/token', (req: Request, res: Response) => {
  return res.status(401).render('create', {
    title: 'Utwórz token',
    login: true,
    message: '',
    token: null,
  });
});

app.post('/create/token', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render('create', {
      title: 'Utwórz token',
      login: false,
      message: 'Nie podano adresu email lub hasła. Spróbuj ponownie.',
      token: null,
    });
  }

  const user = await prisma.user
    .findUnique({
      where: {
        email: String(email),
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (!user) {
    return res.status(404).render('create', {
      title: 'Utwórz token',
      login: false,
      message:
        'Nie znaleziono użytkownika o podanym adresie email. Spróbuj ponownie.',
      token: null,
    });
  }

  // compare passwords

  const match = await comparePasswords(password, user.password);

  if (!match) {
    return res.status(401).render('create', {
      title: 'Utwórz token',
      login: false,
      message:
        'Token o nazwie cf został już utworzony. Możesz go użyć do wysyłania maili.',
      token: null,
    });
  }

  const token = await prisma.token
    .findUnique({
      where: {
        userId: user.id,
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (token) {
    return res.status(201).render('create', {
      title: 'Utwórz token',
      login: false,
      message:
        'Token o nazwie cf został już utworzony. Możesz go użyć do wysyłania maili.',
      token: token.token,
    });
  }

  const newToken = (): string => {
    return `cf-${Math.random().toString(36).substr(2, 9)}`;
  };

  const createToken = await prisma.token
    .create({
      data: {
        id: uuidv4(),
        token: newToken(),
        userId: user.id,
      },
    })
    .catch((error) => {
      console.error(error);
      return null;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

  if (!createToken) {
    return res.status(500).send('Wystąpił błąd podczas tworzenia tokenu');
  }

  return res.status(201).render('create', {
    title: 'Utwórz token',
    login: false,
    message:
      'Token o nazwie cf został już utworzony. Możesz go użyć do wysyłania maili.',
    token: createToken.token,
  });
});

// Get all messages with pagination
app.get('/messages', async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;

  if (Number(page) < 1) {
    // redirect to first page
    return res.redirect('/messages?page=1');
  }

  const messages = await prisma.message
    .findMany({
      skip: Number(page) - 1,
      take: Number(limit),
    })
    .catch((error) => {
      console.error(error);
      return [];
    })
    .then((data) => data)
    .finally(async () => {
      await prisma.$disconnect();
    });

  res.json(messages);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    statusCode: 404,
    message: 'Błąd 404: Nie znaleziono strony',
  });
});

export default app;
