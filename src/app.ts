import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sendMail } from './mail/send';

require('dotenv').config();

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

const accessKey = process.env.API_KEY;

// Middleware do sprawdzania apiKey
const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
  const { apikey } = req.headers;

  console.log(apikey);
  if (apikey !== accessKey) {
    return res.status(403).json({
      message: 'Unauthorized',
    });
  }
  next();
};

app.get('/', checkApiKey, (req: Request, res: Response) => {
  res.json({
    appName: 'Cyber Stack',
    version: '1.0.0',
  });
});

// Użycie middleware do sprawdzania apiKey
app.post('/send', checkApiKey, async (req: Request, res: Response) => {
  const { email, subject, text } = req.body;
  const IP = req.ip;

  const response = await sendMail(email, subject, text);
  await prisma.message.create({
    data: {
      emailTo: String(email),
      subject: String(subject),
      text: String(text),
      ip: String(IP),
    },
  });
  res.json(response);
});

// Get all messages with pagination
app.get('/messages', async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;

  const messages = await prisma.message.findMany({
    skip: Number(page) - 1,
    take: Number(limit),
  });

  res.json(messages);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    statusCode: 404,
    message: 'Not found',
  });
});

export default app;
