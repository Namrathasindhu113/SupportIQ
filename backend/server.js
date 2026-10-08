import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`SupportIQ API running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
  });
};

start();
