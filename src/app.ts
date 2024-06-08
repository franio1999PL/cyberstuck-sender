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

  const response = await sendMail(email, subject, text);
  res.json(response);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    statusCode: 404,
    message: 'Not found',
  });
});

export default app;
