import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 10000,
    };
    
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error('Please ensure MongoDB is running and MONGO_URI is correct.');
    process.exit(1);
  }
};

export default connectDB;
