const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('\n❌ CRITICAL ERROR: MONGODB_URI environment variable is missing!');
            console.error('Please ensure you have configured the MONGODB_URI in your .env file.');
            console.error('Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/college_name\n');
            process.exit(1);
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`\n❌ Database Connection Error: ${error.message}`);
        console.error('Please check if your MongoDB Atlas connection string is correct and the database is accessible.\n');
        process.exit(1);
    }
};

module.exports = connectDB;
