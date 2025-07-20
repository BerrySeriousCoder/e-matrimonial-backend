import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postsRouter from './routes/posts';
import otpRouter from './routes/otp';
import emailRouter from './routes/email';
import uiTextsRouter from './routes/uiTexts';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import adminManagementRouter from './routes/adminManagement';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/posts', postsRouter);
app.use('/api/otp', otpRouter);
app.use('/api/email', emailRouter);
app.use('/api/ui-texts', uiTextsRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/management', adminManagementRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 